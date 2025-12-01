// app/admin/commandes/bordereau/page.tsx
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'

interface Commande {
  id: string
  produit: string
  produitId: string
  imageUrl?: string
  marque?: string | null
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
  } | null
  dateCommande: Date
  numeroGroupe?: string
}

function BordereauContent() {
  const searchParams = useSearchParams()
  const numeroGroupe = searchParams.get('groupe')
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const chargerCommandes = async () => {
      if (!numeroGroupe) return
      
      try {
        const q = query(
          collection(db, 'commandes'),
          where('numeroGroupe', '==', numeroGroupe)
        )
        
        const snap = await getDocs(q)
        const data = snap.docs.map(docSnap => ({
          id: docSnap.id,
          produit: docSnap.data().produit || '',
          produitId: docSnap.data().produitId || '',
          imageUrl: docSnap.data().imageUrl,
          marque: docSnap.data().marque,
          prix: docSnap.data().prix || 0,
          client: docSnap.data().client || {},
          modeLivraison: docSnap.data().modeLivraison,
          adresse: docSnap.data().adresse,
          dateCommande: docSnap.data().dateCommande?.toDate() || new Date(),
          numeroGroupe: docSnap.data().numeroGroupe,
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

  if (loading) return <div className="p-8 text-center">Chargement...</div>
  if (commandes.length === 0) return <div className="p-8 text-center">Aucune commande trouvée</div>

  const client = commandes[0].client
  const adresse = commandes[0].adresse
  const totalPrix = commandes.reduce((sum, c) => sum + c.prix, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barre d'actions */}
      <div className="print:hidden bg-white border-b px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Bordereau d'envoi</h1>
          <button onClick={() => window.print()} className="bg-[#22209C] text-white px-6 py-2 rounded-lg">
            🖨️ Imprimer
          </button>
        </div>
      </div>

      {/* Bordereau */}
      <div className="max-w-4xl mx-auto p-8">
        <div className="bg-white rounded-lg shadow-lg p-8 print:shadow-none">
          {/* En-tête */}
          <div className="flex justify-between items-start mb-8 pb-6 border-b-2">
            <div>
              <h1 className="text-3xl font-bold text-[#22209C]">NOUVELLE RIVE</h1>
              <p className="text-sm text-gray-600 mt-2">Dépôt-vente<br />Paris, France</p>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold">BORDEREAU D'ENVOI</h2>
              <p className="text-sm text-gray-600 mt-2">
                N° {numeroGroupe}<br />
                {new Date().toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>

          {/* Destinataire */}
          <div className="mb-8">
            <h3 className="text-lg font-bold mb-3 pb-2 border-b">📦 DESTINATAIRE</h3>
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
              <p className="text-sm text-gray-600 mt-3">📧 {client.email}</p>
              {client.telephone && <p className="text-sm text-gray-600">📞 {client.telephone}</p>}
            </div>
          </div>

          {/* Contenu */}
          <div className="mb-8">
            <h3 className="text-lg font-bold mb-3 pb-2 border-b">📋 CONTENU DU COLIS</h3>
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-3 py-2 text-sm">Produit</th>
                  <th className="text-right px-3 py-2 text-sm">Prix</th>
                </tr>
              </thead>
              <tbody>
                {commandes.map((c, i) => (
                  <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-3 text-sm">
                      <p className="font-medium">{c.produit}</p>
                      {c.marque && <p className="text-xs text-gray-500">{c.marque}</p>}
                    </td>
                    <td className="px-3 py-3 text-sm text-right font-medium">{c.prix.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-200 font-bold">
                  <td className="px-3 py-3 text-sm">TOTAL ({commandes.length} article{commandes.length > 1 ? 's' : ''})</td>
                  <td className="px-3 py-3 text-sm text-right">{totalPrix.toFixed(2)} €</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Expédition */}
          <div className="mb-8">
            <h3 className="text-lg font-bold mb-3 pb-2 border-b">🚚 EXPÉDITION</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-semibold mb-2">Transporteur</p>
                <p className="text-gray-600">_______________</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-semibold mb-2">N° de suivi</p>
                <p className="text-gray-600">_______________</p>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8">
            <h3 className="font-bold text-yellow-900 mb-2">⚠️ INSTRUCTIONS</h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Vérifier tous les articles</li>
              <li>• Protéger les articles fragiles</li>
              <li>• Coller ce bordereau dans le colis</li>
            </ul>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-6 border-t-2">
            <div>
              <p className="text-sm font-semibold mb-8">Préparé par :</p>
              <div className="border-b h-12"></div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-8">Contrôlé par :</p>
              <div className="border-b h-12"></div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { margin: 1cm; }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
        }
      `}</style>
    </div>
  )
}

export default function BordereauPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Chargement...</div>}>
      <BordereauContent />
    </Suspense>
  )
}