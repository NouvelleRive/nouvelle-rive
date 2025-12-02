// app/admin/nos-produits/page.tsx
'use client'

import { useAdmin } from '@/contexts/AdminContext'
import ProductList, { Produit, Deposant } from '@/components/ProductList'

export default function NosProduits() {
  const { produits: adminProduits, deposants, loading } = useAdmin()

  const produits: Produit[] = adminProduits as Produit[]

  const deposantsList: Deposant[] = deposants.map((d) => ({
    id: d.id,
    email: d.email,
    nom: d.nom,
    trigramme: d.trigramme,
  }))

  return (
    <ProductList
      titre="TOUS LES PRODUITS"
      produits={produits}
      deposants={deposantsList}
      isAdmin={true}
      loading={loading}
    />
  )
}