'use client'

import { useState, useEffect } from 'react'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import ProductGrid from '@/components/ProductGrid'
import { useLang, t } from '@/lib/i18n'

type Produit = any

export default function CoupsDeCoeurPage() {
  const lang = useLang()
  const [produits, setProduits] = useState<Produit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const favSnap = await getDocs(collection(db, 'favoris'))
        const counts = new Map<string, number>()
        favSnap.docs.forEach((d) => {
          const pid = d.data().productId
          if (!pid) return
          counts.set(pid, (counts.get(pid) || 0) + 1)
        })

        const ranked = Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([pid]) => pid)

        const docs = await Promise.all(
          ranked.map((pid) => getDoc(doc(db, 'produits', pid)))
        )

        const items: Produit[] = []
        for (const ds of docs) {
          if (!ds.exists()) continue
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
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p
          className="uppercase tracking-widest"
          style={{
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            fontSize: '11px',
          }}
        >
          {t('Chargement...', 'Loading...', lang)}
        </p>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="px-6 py-20">
        <h1
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

      {produits.length === 0 ? (
        <div className="py-20 text-center">
          <p
            className="uppercase tracking-widest text-gray-400"
            style={{
              fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
              fontSize: '11px',
            }}
          >
            {t('Aucune pièce pour le moment', 'No pieces yet', lang)}
          </p>
        </div>
      ) : (
        <ProductGrid produits={produits} columns={3} />
      )}
    </div>
  )
}
