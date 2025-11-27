// components/ClientsPanel.tsx
'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { Search, Download, Users, RefreshCw } from 'lucide-react'

interface ClientAggrege {
  email: string
  prenom: string
  nom: string
  telephone?: string
  nombreCommandes: number
  totalDepense: number
  derniereCommande: Date
}

export default function ClientsPanel() {
  const [clients, setClients] = useState<ClientAggrege[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchClients = async () => {
    setLoading(true)
    try {
      // Charger toutes les commandes
      const q = query(collection(db, 'commandes'), orderBy('dateCommande', 'desc'))
      const snapshot = await getDocs(q)
      
      // Agréger par email client
      const clientsMap = new Map<string, ClientAggrege>()
      
      snapshot.docs.forEach(doc => {
        const data = doc.data()
        const clientData = data.client
        if (!clientData?.email) return
        
        const email = clientData.email.toLowerCase()
        const prix = data.prix || 0
        const dateCommande = data.dateCommande?.toDate() || new Date()
        
        if (clientsMap.has(email)) {
          const existing = clientsMap.get(email)!
          existing.nombreCommandes += 1
          existing.totalDepense += prix
          if (dateCommande > existing.derniereCommande) {
            existing.derniereCommande = dateCommande
          }
          if (!existing.telephone && clientData.telephone) {
            existing.telephone = clientData.telephone
          }
        } else {
          clientsMap.set(email, {
            email: clientData.email,
            prenom: clientData.prenom || '',
            nom: clientData.nom || '',
            telephone: clientData.telephone || '',
            nombreCommandes: 1,
            totalDepense: prix,
            derniereCommande: dateCommande
          })
        }
      })
      
      const clientsArray = Array.from(clientsMap.values())
        .sort((a, b) => b.derniereCommande.getTime() - a.derniereCommande.getTime())
      
      setClients(clientsArray)
    } catch (error) {
      console.error('Erreur chargement clients:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR')
  }

  const filteredClients = clients.filter(c => 
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.nom?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalRevenu = clients.reduce((sum, c) => sum + (c.totalDepense || 0), 0)
  const totalCommandes = clients.reduce((sum, c) => sum + (c.nombreCommandes || 0), 0)
  const moyenneParClient = clients.length > 0 ? totalRevenu / clients.length : 0

  const exportCSV = () => {
    const csv = [
      ['Prénom', 'Nom', 'Email', 'Téléphone', 'Commandes', 'Total dépensé', 'Dernière commande'].join(','),
      ...clients.map(c => [
        c.prenom, 
        c.nom, 
        c.email, 
        c.telephone || '', 
        c.nombreCommandes, 
        c.totalDepense.toFixed(2),
        formatDate(c.derniereCommande)
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `clients-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Clients</h2>
        <button
          onClick={fetchClients}
          className="flex items-center gap-2 px-3 py-2 text-sm border rounded hover:bg-gray-50"
        >
          <RefreshCw size={14} />
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="border rounded p-4">
          <p className="text-xs text-gray-500 uppercase">Clients</p>
          <p className="text-2xl font-bold">{clients.length}</p>
        </div>
        <div className="border rounded p-4">
          <p className="text-xs text-gray-500 uppercase">Commandes</p>
          <p className="text-2xl font-bold">{totalCommandes}</p>
        </div>
        <div className="border rounded p-4">
          <p className="text-xs text-gray-500 uppercase">Revenu total</p>
          <p className="text-2xl font-bold">{totalRevenu.toFixed(0)} €</p>
        </div>
        <div className="border rounded p-4">
          <p className="text-xs text-gray-500 uppercase">Panier moyen</p>
          <p className="text-2xl font-bold">{moyenneParClient.toFixed(0)} €</p>
        </div>
      </div>

      {/* Recherche + Export */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded text-sm"
          />
        </div>
        <button 
          onClick={exportCSV} 
          disabled={clients.length === 0}
          className="flex items-center gap-2 px-4 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <Download size={14} />
          CSV
        </button>
      </div>

      {/* Tableau */}
      <div className="border rounded overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase text-gray-500">Client</th>
              <th className="text-left px-4 py-3 text-xs font-medium uppercase text-gray-500">Contact</th>
              <th className="text-center px-4 py-3 text-xs font-medium uppercase text-gray-500">Cmd</th>
              <th className="text-right px-4 py-3 text-xs font-medium uppercase text-gray-500">Total</th>
              <th className="text-right px-4 py-3 text-xs font-medium uppercase text-gray-500">Dernière</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredClients.map((c) => (
              <tr key={c.email} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-sm">{c.prenom} {c.nom}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-gray-600">{c.email}</p>
                  {c.telephone && <p className="text-xs text-gray-400">{c.telephone}</p>}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center justify-center w-6 h-6 bg-[#22209C] text-white text-xs font-medium rounded">
                    {c.nombreCommandes}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-sm">{c.totalDepense.toFixed(2)} €</td>
                <td className="px-4 py-3 text-right text-sm text-gray-500">{formatDate(c.derniereCommande)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredClients.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            <Users size={32} className="mx-auto mb-2" />
            {searchTerm ? 'Aucun client trouvé' : 'Aucun client'}
          </div>
        )}
      </div>
    </div>
  )
}