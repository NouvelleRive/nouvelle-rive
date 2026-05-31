'use client'

import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import ProductGrid from '@/components/ProductGrid'
import { useLang, t } from '@/lib/i18n'
import type { ProduitInitial } from '@/lib/produitsServer'

type Produit = any

export default function CoupsDeCoeurClient({ initialProduits = [] }: { initialProduits?: ProduitInitial[] }) {
  const lang = useLang()
  const [produits, setProduits] = useState<Produit[]>([])

  useEffect(() => {
    async function load() {
      try {
        const q = query(
          collection(db, 'produits'),
          where('likesCount', '>', 0),
          orderBy('likesCount', 'desc')
        )
        const snap = await getDocs(q)
        const items: Produit[] = []
        for (const ds of snap.docs) {
          const p: any = { id: ds.id, ...ds.data() }
          const quantite = p.quantite ?? 1
          if (quantite <= 0) continue
          if (p.vendu) continue
          if (p.statut === 'retour' || p.statut === 'supprime') continue
          if (p.recu === false) continue
          if (p.hidden === true) continue
          if (p.forceDisplay === false) continue
          const hasImage = (p.imageUrls && p.imageUrls.length > 0) || p.imageUrl
          if (!hasImage) continue
          items.push(p)
        }
        setProduits(items)
      } catch (err) {
        console.error('Erreur coups-de-coeur:', err)
      }
    }
    load()
  }, [])

  const display = (produits.length > 0 ? produits : initialProduits) as any

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="px-6 py-20">
        <h1
          id="titre"
          style={{
            fontSize: 'clamp(40px, 8vw, 120px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 0.9,
            textTransform: 'uppercase',
          }}
        >
          {t('Nos pièces préférées', 'Our favourites', lang)}
        </h1>
      </div>
      <div className="w-full border-t border-black" />

      {display.length === 0 ? (
        <div className="py-20 text-center">
          <p
            className="uppercase tracking-widest text-gray-400"
            style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: '11px' }}
          >
            {t('Aucune pièce pour le moment', 'No pieces yet', lang)}
          </p>
        </div>
      ) : (
        <ProductGrid produits={display} columns={3} />
      )}
    </div>
  )
}
