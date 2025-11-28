// src/app/admin/commandes/bordereau/page.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'

interface Commande {
  id: string
  productName: string
  productSku?: string
  productMarque?: string
  prix: number
  client: {
    nom: string
    prenom: string
    email: string
    telephone?: string
  }
  modeLivraison: 'livraison' | 'retrait'
  adresse?: {
    rue: string
    complementAdresse?: string
    codePostal: string
    ville: string
    pays: string
  }
  dateCommande: Date
  numeroGroupe?: string
}

export default function BordereauPage() {
  const searchParams = useSearchParams()
  const numeroGroupe = searchParams.get('groupe')
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [loading, setLoading] = useState(true)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const chargerCommandes = async () => {
      if (!numeroGroupe) return
      
      try {
        const q = query(
          collection(db, 'commandes'),
          where('numeroGroupe', '==', numeroGroupe)
        )
        
        const snap = await getDocs(q)
        const data = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          dateCommande: doc.data().dateCommande?.toDate()
        })) as Commande[]
        
        setCommandes(data)
      } catch (error) {
        console.error('Erreur:', error)
      } finally {
        setLoading(false)
      }
    }
    
    chargerCommandes()
  }, [numeroGroupe])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return <div className="p-8 text-center">Chargement...</div>
  }

  if (commandes.length === 0) {
    return <div className="p-8 text-center">Aucune commande trouvée</div>
  }

  const client = commandes[0].client
  const adresse = commandes[0].adresse
  const totalPrix = commandes.reduce((sum, c) => sum + c.prix, 0)
  const totalArticles = commandes.length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barre d'actions (ne s'imprime pas) */}
      <div className="print:hidden bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Bordereau d'envoi</h1>
          <button
            onClick={handlePrint}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 font-medium"
          >
            🖨️ Imprimer
          </button>
        </div>
      </div>

      {/* Bordereau à imprimer */}
      <div ref={printRef} className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-lg p-8 print:shadow-none">
          {/* En-tête */}
          <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-300">
            <div>
              <h1 className="text-3xl font-bold text-indigo-900">NOUVELLE RIVE</h1>
              <p className="text-sm text-gray-600 mt-2">
                Dépôt-vente<br />
                Paris, France<br />
                nouvelleriveparis@gmail.com
              </p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-gray-900">BORDEREAU D'ENVOI</h2>
              <p className="text-sm text-gray-600 mt-2">
                N° {numeroGroupe}<br />
                Date: {new Date().toLocaleDateString('fr-FR')}<br />
                Heure: {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          {/* Destinataire */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-300">
              📦 DESTINATAIRE
            </h3>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-lg font-bold">{client.prenom} {client.nom}</p>
              {adresse && (
                <div className="mt-2 text-gray-700">
                  <p>{adresse.rue}</p>
                  {adresse.complementAdresse && <p>{adresse.complementAdresse}</p>}
                  <p className="font-semibold mt-1">{adresse.codePostal} {adresse.ville}</p>
                  <p>{adresse.pays}</p>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-gray-300">
                <p className="text-sm text-gray-600">📧 {client.email}</p>
                {client.telephone && (
                  <p className="text-sm text-gray-600">📞 {client.telephone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Détails du colis */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-300">
              📋 CONTENU DU COLIS
            </h3>
            
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-3 py-2 text-sm font-semibold">Produit</th>
                  <th className="text-left px-3 py-2 text-sm font-semibold">Référence</th>
                  <th className="text-right px-3 py-2 text-sm font-semibold">Prix</th>
                </tr>
              </thead>
              <tbody>
                {commandes.map((commande, index) => (
                  <tr key={commande.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-3 text-sm">
                      <div>
                        <p className="font-medium">{commande.productName}</p>
                        {commande.productMarque && (
                          <p className="text-xs text-gray-500">{commande.productMarque}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">
                      {commande.productSku || '-'}
                    </td>
                    <td className="px-3 py-3 text-sm text-right font-medium">
                      {commande.prix.toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-200 font-bold">
                  <td className="px-3 py-3 text-sm" colSpan={2}>
                    TOTAL ({totalArticles} article{totalArticles > 1 ? 's' : ''})
                  </td>
                  <td className="px-3 py-3 text-sm text-right">
                    {totalPrix.toFixed(2)} €
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Informations expédition */}
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-3 pb-2 border-b border-gray-300">
              🚚 INFORMATIONS EXPÉDITION
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700 mb-2">Transporteur</p>
                <p className="text-gray-600">À renseigner : _______________</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-semibold text-gray-700 mb-2">N° de suivi</p>
                <p className="text-gray-600">À renseigner : _______________</p>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
            <h3 className="font-bold text-yellow-900 mb-2">⚠️ INSTRUCTIONS</h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Vérifier que tous les articles listés sont bien emballés</li>
              <li>• Protéger les articles fragiles avec du papier bulle</li>
              <li>• Coller ce bordereau à l'intérieur du colis</li>
              <li>• Noter le numéro de suivi dans l'application après expédition</li>
            </ul>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-6 border-t-2 border-gray-300">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-8">Préparé par :</p>
              <div className="border-b border-gray-400 h-16"></div>
              <p className="text-xs text-gray-500 mt-2">Signature et date</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-8">Contrôlé par :</p>
              <div className="border-b border-gray-400 h-16"></div>
              <p className="text-xs text-gray-500 mt-2">Signature et date</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-300 text-center">
            <p className="text-xs text-gray-500">
              Document généré automatiquement le {new Date().toLocaleString('fr-FR')}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Nouvelle Rive - Système de gestion des commandes
            </p>
          </div>
        </div>
      </div>

      {/* Styles d'impression */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 1cm;
          }
          
          body {
            background: white;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:shadow-none {
            box-shadow: none !important;
          }
        }
      `}</style>
    </div>
  )
}