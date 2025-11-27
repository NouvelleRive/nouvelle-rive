'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'

function BordereauContent() {
  const searchParams = useSearchParams()
  const groupe = searchParams.get('groupe')
  const [commandes, setCommandes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!groupe) return
    const fetchCommandes = async () => {
      const q = query(collection(db, 'commandes'), where('numeroGroupe', '==', groupe))
      const snap = await getDocs(q)
      setCommandes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }
    fetchCommandes()
  }, [groupe])

  if (!groupe) return <div className="p-8 text-center">Aucun groupe spécifié</div>
  if (loading) return <div className="p-8 text-center">Chargement...</div>
  if (commandes.length === 0) return <div className="p-8 text-center">Aucune commande trouvée</div>

  const client = commandes[0]?.client || {}
  const adresse = commandes[0]?.adresse || {}
  const total = commandes.reduce((sum, c) => sum + (c.prix || 0), 0)

  return (
    <div className="max-w-2xl mx-auto p-8 bg-white min-h-screen">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">NOUVELLE RIVE</h1>
        <p className="text-sm text-gray-600">23 rue du Pont Louis-Philippe, 75004 Paris</p>
      </div>

      <h2 className="text-xl font-bold mb-4">BORDEREAU DE LIVRAISON</h2>
      <p className="text-sm text-gray-500 mb-6">Groupe: {groupe}</p>

      <div className="border-t border-b py-4 mb-6">
        <p className="font-semibold">{client.prenom} {client.nom}</p>
        <p>{adresse.rue}</p>
        {adresse.complementAdresse && <p>{adresse.complementAdresse}</p>}
        <p>{adresse.codePostal} {adresse.ville}</p>
        <p>{adresse.pays}</p>
        {client.email && <p className="text-sm text-gray-600">{client.email}</p>}
        {client.telephone && <p className="text-sm text-gray-600">{client.telephone}</p>}
      </div>

      <table className="w-full mb-6">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2">Article</th>
            <th className="text-right py-2">Prix</th>
          </tr>
        </thead>
        <tbody>
          {commandes.map((c, i) => (
            <tr key={i} className="border-b">
              <td className="py-2">
                <p className="font-medium">{c.sku || c.productSku}</p>
                <p className="text-sm text-gray-600">{c.produit || c.productName}</p>
              </td>
              <td className="text-right py-2">{(c.prix || 0).toFixed(2)} €</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td className="py-2">TOTAL ({commandes.length} article{commandes.length > 1 ? 's' : ''})</td>
            <td className="text-right py-2">{total.toFixed(2)} €</td>
          </tr>
        </tfoot>
      </table>

      <div className="border p-4 mb-6">
        <p className="font-semibold mb-2">Expédition</p>
        <p>Transporteur: _______________________</p>
        <p>N° de suivi: _______________________</p>
      </div>

      <div className="text-sm text-gray-600 mb-6">
        <p className="font-semibold mb-1">Instructions:</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Vérifier tous les articles</li>
          <li>Protéger avec du papier de soie</li>
          <li>Coller ce bordereau sur le colis</li>
          <li>Noter le numéro de suivi</li>
        </ol>
      </div>

      <div className="flex justify-between mt-8 pt-4 border-t">
        <div>
          <p className="text-sm">Préparé par: _______________</p>
        </div>
        <div>
          <p className="text-sm">Contrôlé par: _______________</p>
        </div>
      </div>

      <p className="text-xs text-gray-400 text-center mt-8">
        Généré le {new Date().toLocaleString('fr-FR')}
      </p>
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
