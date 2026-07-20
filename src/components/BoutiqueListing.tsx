'use client'

import { useEffect, useRef, useState } from 'react'
import { useFilteredProducts } from '@/lib/siteConfig'
import ProductGrid from '@/components/ProductGrid'
import CountdownPromo from '@/components/CountdownPromo'
import { useLang, t } from '@/lib/i18n'
import type { ProduitInitial } from '@/lib/produitsServer'

const INFINITE_PAGE_SIZE = 60

type BoutiqueListingProps = {
  initialProduits?: ProduitInitial[]
  pageId?: string
  h1Fr?: string
  h1En?: string
  /** true → on n'ré-appelle pas useFilteredProducts, on affiche uniquement initialProduits.
   *  Utile pour les pages qui font un filtre custom SSR non représentable dans siteConfig. */
  skipClientRefetch?: boolean
  /** Mode /boutique "TOUT VOIR" : on ignore pageId + siteConfig, on charge la liste complète
   *  depuis /api/boutique-produits (cache 6h à l'edge, 0 read Firestore) et on paginate côté
   *  client via IntersectionObserver. */
  allBoutiqueMode?: boolean
}

export default function BoutiqueListing({
  initialProduits = [],
  pageId = 'new-in',
  h1Fr,
  h1En,
  skipClientRefetch = false,
  allBoutiqueMode = false,
}: BoutiqueListingProps) {
  const { produits, loadingMore } = useFilteredProducts(pageId, {
    skip: skipClientRefetch || allBoutiqueMode,
  })
  const [nombreAchats, setNombreAchats] = useState(0)
  const lang = useLang()

  // Mode "toute la boutique" — liste complète cachée + infinite scroll côté client.
  const [allBoutique, setAllBoutique] = useState<ProduitInitial[]>([])
  const [infiniteCount, setInfiniteCount] = useState(INFINITE_PAGE_SIZE)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Au retour d'une pièce, on remonte au même niveau de scroll infini : sans ça
  // la pièce d'où l'on vient n'est même pas rendue et le scroll ne peut pas
  // être restauré. Clé par onglet, comme le reste de l'état de navigation.
  const countKey = 'boutique_infiniteCount'
  const countRestored = useRef(false)
  useEffect(() => {
    if (!allBoutiqueMode) return
    const saved = Number(sessionStorage.getItem(countKey))
    if (Number.isFinite(saved) && saved > INFINITE_PAGE_SIZE) setInfiniteCount(saved)
    countRestored.current = true
  }, [allBoutiqueMode])

  useEffect(() => {
    if (!allBoutiqueMode || !countRestored.current) return
    try {
      sessionStorage.setItem(countKey, String(infiniteCount))
    } catch {
      /* storage bloqué : sans persistance on repart du haut, rien de casse */
    }
  }, [allBoutiqueMode, infiniteCount])

  useEffect(() => {
    const achats = localStorage.getItem('nouvelle-rive-achats')
    setNombreAchats(achats ? parseInt(achats) : 0)
  }, [])

  useEffect(() => {
    if (!allBoutiqueMode) return
    let cancelled = false
    fetch('/api/boutique-produits')
      .then(r => (r.ok ? r.json() : { produits: [] }))
      .then((data: { produits?: ProduitInitial[] }) => {
        if (cancelled) return
        if (Array.isArray(data.produits)) setAllBoutique(data.produits)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [allBoutiqueMode])

  // Choix de la source affichée : mode all-boutique = liste API paginée, sinon logique siteConfig.
  const allBoutiqueSource = allBoutique.length > 0 ? allBoutique : initialProduits
  const displayProduits = (
    allBoutiqueMode
      ? allBoutiqueSource.slice(0, infiniteCount)
      : (produits.length > 0 ? produits : initialProduits)
  ) as any
  // Pendant une recherche, ProductGrid cherche dans la liste complète : on suspend
  // la pagination pour ne pas afficher un "Chargement..." qui n'a plus de sens.
  const [searchActive, setSearchActive] = useState(false)
  const hasMore = allBoutiqueMode && !searchActive && allBoutiqueSource.length > infiniteCount

  useEffect(() => {
    if (!hasMore) return
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) setInfiniteCount(c => c + INFINITE_PAGE_SIZE)
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore])

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      {h1Fr && h1En && (
        <>
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
              {t(h1Fr, h1En, lang)}
            </h1>
          </div>
          <div className="w-full border-t border-black" />
        </>
      )}
      <ProductGrid
        produits={displayProduits}
        columns={3}
        facetSource={allBoutiqueMode ? (allBoutiqueSource as any) : undefined}
        onSearchActiveChange={allBoutiqueMode ? setSearchActive : undefined}
      />

      {(loadingMore || hasMore) && (
        <div ref={hasMore ? sentinelRef : undefined} className="py-8 text-center">
          <p className="text-gray-500 text-sm">{t('Chargement...', 'Loading...', lang)}</p>
        </div>
      )}

      <CountdownPromo nombreAchats={nombreAchats} />

      <footer className="border-t py-8 mt-12">
        <div className="text-center text-gray-600 text-sm space-y-2">
          <p>© 2026 NOUVELLE RIVE • 8 rue des Écouffes, Paris</p>
          <div className="flex justify-center gap-4 text-xs text-gray-400">
            <a href="/legal/mentions-cgv" className="hover:text-black transition-colors">
              {t('Mentions légales & CGV', 'Legal notice & Terms', lang)}
            </a>
            <a href="/legal/retours" className="hover:text-black transition-colors">
              {t('Retours', 'Returns', lang)}
            </a>
            <a href="/legal/confidentialite" className="hover:text-black transition-colors">
              {t('Confidentialité', 'Privacy', lang)}
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
