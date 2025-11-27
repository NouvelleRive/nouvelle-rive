// app/bordereau/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'

interface Commande {
  id: string
  produit: string
  sku?: string
  marque?: string
  taille?: string
  prix: number
  client: {
    nom: string
    prenom: string
    email: string
    telephone?: string
  }
  adresse?: {
    rue: string
    complementAdresse?: string
    codePostal: string
    ville: string
    pays: string
  }
  numeroGroupe?: string
}

export default function BordereauPage() {
  const searchParams = useSearchParams()
  const groupe = searchParams.get('groupe')
  
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const charger = async () => {
      if (!groupe) return
      
      try {
        // Essayer de charger par numeroGroupe
        let snap = await getDocs(
          query(collection(db, 'commandes'), where('numeroGroupe', '==', groupe))
        )
        
        // Si pas trouvé, chercher par ID direct
        if (snap.empty) {
          snap = await getDocs(
            query(collection(db, 'commandes'), where('__name__', '==', groupe))
          )
        }
        
        const data = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as Commande[]
        
        setCommandes(data)
      } catch (err) {
        console.error('Erreur chargement:', err)
      } finally {
        setLoading(false)
      }
    }
    
    charger()
  }, [groupe])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Chargement...</p>
      </div>
    )
  }

  if (commandes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Aucune commande trouvée</p>
      </div>
    )
  }

  const client = commandes[0].client
  const adresse = commandes[0].adresse
  const totalPrix = commandes.reduce((sum, c) => sum + (c.prix || 0), 0)

  return (
    <>
      {/* Styles pour l'impression */}
      <style jsx global>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          .print-page { page-break-after: always; }
        }
      `}</style>

      <div className="max-w-2xl mx-auto p-8">
        {/* Bouton imprimer */}
        <div className="no-print mb-6 flex gap-4">
          <button
            onClick={handlePrint}
            className="bg-[#22209C] text-white px-6 py-2 rounded-lg hover:bg-[#1a1a7e]"
          >
            🖨️ Imprimer
          </button>
          <button
            onClick={() => window.close()}
            className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300"
          >
            Fermer
          </button>
        </div>

        {/* Bordereau */}
        <div className="border-2 border-black p-6 print-page">
          {/* En-tête */}
          <div className="text-center border-b-2 border-black pb-4 mb-6">
            <h1 className="text-2xl font-bold uppercase tracking-wider">Nouvelle Rive</h1>
            <p className="text-sm text-gray-600 mt-1">Vintage from Paris</p>
          </div>

          {/* Destinataire */}
          <div className="mb-6">
            <p className="text-xs text-gray-500 uppercase mb-2">Destinataire</p>
            <div className="border border-gray-300 p-4 bg-gray-50">
              <p className="font-bold text-lg">
                {client.prenom} {client.nom}
              </p>
              {adresse && (
                <>
                  <p className="mt-2">{adresse.rue}</p>
                  {adresse.complementAdresse && <p>{adresse.complementAdresse}</p>}
                  <p>{adresse.codePostal} {adresse.ville}</p>
                  <p className="font-medium">{adresse.pays}</p>
                </>
              )}
              {client.telephone && (
                <p className="mt-2 text-sm">📞 {client.telephone}</p>
              )}
              <p className="text-sm text-gray-600">✉️ {client.email}</p>
            </div>
          </div>

          {/* Articles */}
          <div className="mb-6">
            <p className="text-xs text-gray-500 uppercase mb-2">Articles ({commandes.length})</p>
            <table className="w-full border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border border-gray-300 px-3 py-2 text-left text-sm">SKU</th>
                  <th className="border border-gray-300 px-3 py-2 text-left text-sm">Article</th>
                  <th className="border border-gray-300 px-3 py-2 text-right text-sm">Prix</th>
                </tr>
              </thead>
              <tbody>
                {commandes.map((c) => (
                  <tr key={c.id}>
                    <td className="border border-gray-300 px-3 py-2 font-mono text-sm">
                      {c.sku || '—'}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-sm">
                      <span className="font-medium">{c.produit}</span>
                      {c.marque && <span className="text-gray-500"> • {c.marque}</span>}
                      {c.taille && <span className="text-gray-500"> • T.{c.taille}</span>}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 text-right text-sm">
                      {c.prix?.toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100 font-bold">
                <tr>
                  <td colSpan={2} className="border border-gray-300 px-3 py-2 text-right">
                    Total
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-right">
                    {totalPrix.toFixed(2)} €
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Expéditeur */}
          <div className="border-t-2 border-black pt-4 mt-6">
            <p className="text-xs text-gray-500 uppercase mb-2">Expéditeur</p>
            <p className="font-bold">NOUVELLE RIVE</p>
            <p className="text-sm">23 rue du Pont Louis-Philippe</p>
            <p className="text-sm">75004 Paris, France</p>
          </div>

          {/* Numéro de groupe */}
          {groupe && (
            <div className="mt-4 pt-4 border-t border-dashed border-gray-300 text-center">
              <p className="text-xs text-gray-400">Réf: {groupe}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}