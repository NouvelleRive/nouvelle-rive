// components/ProductGrid.tsx
'use client'

import Link from 'next/link'
import { useState, useRef, useEffect, useMemo } from 'react'
import FavoriteButton from '@/components/FavoriteButton'
import LazyAutoplayVideo from '@/components/LazyAutoplayVideo'
import { COLOR_PALETTE } from '@/lib/couleurs'
import { getModelesForCategorie } from '@/lib/modeles'
import { getMatieresForCategorie } from '@/lib/matieres'
import { MOTIFS } from '@/lib/motifs'
import { MACRO_ORDER, getMacroCategorie } from '@/lib/categories'
import { LUXURY_BRANDS } from '@/lib/admin/helpers'
import { buildProduitSlug } from '@/lib/produitSlug'
import { useLang, t, translateCategory, translateProductTitle, translateMaterial, translateColor, translateMotif, translateModele, translateSize, type Lang } from '@/lib/i18n'
import { formatPrix } from '@/lib/formatPrix'
import { getCloudinaryUrl, getCloudinarySrcSet, CLOUDINARY_GRID_SIZES } from '@/lib/cloudinary'

type ChineuseLite = {
  uid: string
  slug: string
  trigramme: string
  email: string
  emails: string[]
  videos: string[]
}

function formatDisplayTitle(produit: Produit, lang: Lang = 'fr'): string {
  // Si traduction Firestore dispo en EN, on l'utilise direct (priorité absolue)
  const sourceTitle = (lang === 'en' && produit.nomEn) ? produit.nomEn : produit.nom

  // 1. Enlever le SKU du début
  let title = sourceTitle.replace(/^[A-Z]+\d+\s*[-–]\s*/i, '')

  // 2. Enlever la marque du titre (elle s'affiche séparément en dessous)
  if (produit.marque) {
    const marqueRegex = new RegExp(produit.marque.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    title = title.replace(marqueRegex, '').replace(/\s*[-–]\s*$/, '').replace(/^\s*[-–]\s*/, '').trim()
  }

  // 3. Enrichir avec matière, couleur, taille si pas déjà dans le titre
  const titleLower = title.toLowerCase()
  const extras: string[] = []

  if (produit.material && !titleLower.includes(produit.material.toLowerCase().split(',')[0].trim())) {
    const mat = produit.material.split(',')[0].trim()
    extras.push(translateMaterial(mat, lang))
  }
  if (produit.color && !titleLower.includes(produit.color.toLowerCase().split(',')[0].trim())) {
    const col = produit.color.split(',')[0].trim()
    extras.push(translateColor(col, lang))
  }
  if (produit.taille && !titleLower.includes(produit.taille.toLowerCase())) {
    extras.push(translateSize(produit.taille, lang))
  }

  // Si on a déjà la traduction Firestore on l'utilise telle quelle.
  // Sinon (EN sans nomEn ou FR), on passe par le dictionnaire.
  const useFirestoreEn = lang === 'en' && !!produit.nomEn
  const baseTitle = useFirestoreEn ? title : translateProductTitle(title, lang)

  if (extras.length > 0) {
    return (baseTitle + ' ' + extras.join(' ')).replace(/\s+/g, ' ').trim()
  }

  return baseTitle.replace(/\s+/g, ' ').trim()
}

type Produit = {
  id: string
  nom: string
  nomEn?: string
  prix: number
  imageUrls: string[]
  marque?: string
  taille?: string
  color?: string
  material?: string
  modele?: string
  motif?: string
  categorie?: any
  vendu: boolean
  promotion?: boolean
  createdAt?: any
  sku?: string
  /** Rupture temporaire de stock (quantite=0 mais pas vendu). Utilisé sur /iconiques* pour
   *  afficher un produit de la collection en rupture avec un badge dédié. */
  rupture?: boolean
}

interface ProductGridProps {
  produits: Produit[]
  columns?: 1 | 2 | 3 | 4
  showFilters?: boolean
  emphasizeBrand?: boolean
  /** Si défini, seules les chineuses dont le trigramme est dans cette liste peuvent
   *  fournir une vidéo intercalée dans la grille. Utilisé sur /luxe pour ne montrer
   *  que les vidéos PS / SOI / PRI. */
  videoTrigrammeWhitelist?: string[]
}


export default function ProductGrid({ produits, columns = 3, showFilters = true, emphasizeBrand = false, videoTrigrammeWhitelist }: ProductGridProps) {
  const lang = useLang()
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isTriOpen, setIsTriOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const triRef = useRef<HTMLDivElement>(null)

  // Fréquence d'intercalation des vidéos : 7 partout (desktop + mobile).
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsDesktop(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  // Restaurer la position de scroll au retour d'une page produit
  useEffect(() => {
    const saved = sessionStorage.getItem('productGrid_scrollY')
    if (saved) {
      const y = parseInt(saved)
      sessionStorage.removeItem('productGrid_scrollY')
      // Scroll immédiat sans smooth pour éviter le flash
      window.scrollTo(0, y)
      // Re-scroll après le premier paint au cas où le layout n'était pas prêt
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo(0, y)
        })
      })
    }
  }, [])

  // Chineuses (avec leurs videos) — pour intercaler une vidéo toutes les 7 pièces.
  // Fetch via /api/chineuses-lite (cache Vercel 1h) au lieu d'un getDocs Firestore
  // direct à chaque montage : évite 1 scan collection chineuse par visite publique.
  const [chineuses, setChineuses] = useState<ChineuseLite[]>([])
  useEffect(() => {
    let alive = true
    fetch('/api/chineuses-lite')
      .then(r => r.ok ? r.json() : [])
      .then((list: ChineuseLite[]) => {
        if (!alive) return
        if (Array.isArray(list)) setChineuses(list)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const [filters, setFilters] = useState({
    promotion: false,
    marque: [] as string[],
    prixMin: '',
    prixMax: '',
    categorie: '',
    sousCats: [] as string[],
    taille: [] as string[],
    color: [] as string[],
    material: [] as string[],
    modele: [] as string[],
    motif: [] as string[],
  })
  const [tri, setTri] = useState('nouveautes')

  const [marqueSearch, setMarqueSearch] = useState('')

  // Accordéons filtres — tous fermés au démarrage
  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const triLabels: { [key: string]: string } = {
    'nouveautes': t('Nouveautés', 'New in', lang),
    'prix-asc': t('Prix croissant', 'Price: low to high', lang),
    'prix-desc': t('Prix décroissant', 'Price: high to low', lang),
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (triRef.current && !triRef.current.contains(event.target as Node)) {
        setIsTriOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const categories = MACRO_ORDER.filter(macro =>
    produits.some(p => {
      const label = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
      return label && getMacroCategorie(label) === macro
    })
  )

  const sousCategories = filters.categorie
    ? [...new Set(produits
        .filter(p => {
          const label = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
          return label && getMacroCategorie(label) === filters.categorie
        })
        .map(p => {
          const label = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
          if (!label) return null
          const parts = label.split(' - ')
          return parts.length > 1 ? parts.slice(1).join(' - ').trim() : label.trim()
        })
        .filter(Boolean) as string[]
      )].sort((a, b) => a.localeCompare(b, 'fr'))
    : []

  const marques = [...new Set(produits.map(p => p.marque).filter(Boolean))].sort((a, b) => a!.localeCompare(b!, 'fr'))

  const isMarqueLuxe = (m: string) => {
    const low = m.toLowerCase().trim()
    return LUXURY_BRANDS.some(b => low.includes(b) || b.includes(low))
  }
  const marquesLuxePresentes = marques.filter((m): m is string => !!m && isMarqueLuxe(m))
  const luxeToutSelectionne = marquesLuxePresentes.length > 0
    && marquesLuxePresentes.every(m => filters.marque.includes(m))
  const marqueSearchNorm = marqueSearch.trim().toLowerCase()
  const marquesAffichees = marqueSearchNorm
    ? marques.filter(m => !!m && m.toLowerCase().includes(marqueSearchNorm))
    : marques

  // Produits filtrés par catégorie pour les sous-filtres
  const produitsParCat = filters.categorie
    ? produits.filter(p => {
        const label = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
        if (!label || getMacroCategorie(label) !== filters.categorie) return false
        if (filters.sousCats.length === 0) return true
        const parts = label.split(' - ')
        const sousCat = parts.length > 1 ? parts.slice(1).join(' - ').trim() : label.trim()
        return filters.sousCats.includes(sousCat)
      })
    : produits

  const tailleOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'TAILLE UNIQUE']
  const tailles = [...new Set(produitsParCat.map(p => p.taille).filter(Boolean))].sort((a, b) => {
    const iA = tailleOrder.indexOf(a!.toUpperCase())
    const iB = tailleOrder.indexOf(b!.toUpperCase())
    if (iA !== -1 && iB !== -1) return iA - iB
    if (iA !== -1) return -1
    if (iB !== -1) return 1
    return a!.localeCompare(b!)
  })
  const couleurs = (() => {
    const set = new Set<string>()
    for (const p of produitsParCat) {
      if (!p.color) continue
      for (const c of p.color.split(',').map(s => s.trim()).filter(Boolean)) {
        set.add(c)
      }
    }
    const paletteIndex = new Map(COLOR_PALETTE.map((c, i) => [c.name, i]))
    return [...set].sort((a, b) => {
      const iA = paletteIndex.get(a) ?? Infinity
      const iB = paletteIndex.get(b) ?? Infinity
      if (iA !== iB) return iA - iB
      return a.localeCompare(b)
    })
  })()

  // Matières et modèles depuis les libs si catégorie sélectionnée
  const matieresLib = filters.categorie
    ? [...new Set(produitsParCat.flatMap(p => {
        const label = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
        return label ? getMatieresForCategorie(label) : []
      }))]
    : []
  const matieresPresentes = (() => {
    const set = new Set<string>()
    for (const p of produitsParCat) {
      if (!p.material) continue
      for (const m of p.material.split(',').map(s => s.trim()).filter(Boolean)) {
        set.add(m)
      }
    }
    return [...set]
  })()
  const matieres = matieresLib.length > 0
    ? matieresLib.filter(m => matieresPresentes.includes(m))
    : matieresPresentes.sort()

  const modelesLib = filters.categorie
    ? [...new Set(produitsParCat.flatMap(p => {
        const label = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
        return label ? getModelesForCategorie(label) : []
      }))]
    : []
  const modelesPresents = [...new Set(produitsParCat.map(p => p.modele).filter(Boolean))] as string[]
  const modeles = modelesLib.length > 0
    ? modelesLib.filter(m => modelesPresents.includes(m))
    : modelesPresents.sort()

    const motifsPresents = [...new Set(produitsParCat.map(p => p.motif).filter(Boolean))] as string[]
  const motifs = MOTIFS.filter(m => motifsPresents.includes(m))

  let filteredProduits = [...produits]

  if (filters.categorie) {
    filteredProduits = filteredProduits.filter(p => {
      const label = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie
      if (!label || getMacroCategorie(label) !== filters.categorie) return false
      if (filters.sousCats.length === 0) return true
      const parts = label.split(' - ')
      const sousCat = parts.length > 1 ? parts.slice(1).join(' - ').trim() : label.trim()
      return filters.sousCats.includes(sousCat)
    })
  }
  
  if (filters.promotion) {
    filteredProduits = filteredProduits.filter(p => p.promotion)
  }
  if (filters.marque.length > 0) {
    filteredProduits = filteredProduits.filter(p => p.marque && filters.marque.includes(p.marque))
  }
  if (filters.prixMin) {
    filteredProduits = filteredProduits.filter(p => p.prix >= Number(filters.prixMin))
  }
  if (filters.prixMax) {
    filteredProduits = filteredProduits.filter(p => p.prix <= Number(filters.prixMax))
  }
  if (filters.taille.length > 0) {
    filteredProduits = filteredProduits.filter(p => p.taille && filters.taille.includes(p.taille))
  }
  if (filters.color.length > 0) {
    filteredProduits = filteredProduits.filter(p => {
      if (!p.color) return false
      const parts = p.color.split(',').map(s => s.trim()).filter(Boolean)
      return parts.some(c => filters.color.includes(c))
    })
  }
  if (filters.material.length > 0) {
    filteredProduits = filteredProduits.filter(p => {
      if (!p.material) return false
      const parts = p.material.split(',').map(s => s.trim()).filter(Boolean)
      return parts.some(m => filters.material.includes(m))
    })
  }

  if (filters.modele.length > 0) {
    filteredProduits = filteredProduits.filter(p => p.modele && filters.modele.includes(p.modele))
  }

  if (filters.motif.length > 0) {
    filteredProduits = filteredProduits.filter(p => p.motif && filters.motif.includes(p.motif))
  }

  // Filtrage par recherche (texte libre, multi-mots)
  if (searchQuery.trim()) {
    const stripAccents = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const searchTerms = stripAccents(searchQuery).split(/\s+/).filter(t => t.length > 0)

    filteredProduits = filteredProduits.filter(p => {
      const cat = typeof p.categorie === 'object' ? (p.categorie as any)?.label : p.categorie
      const description = (p as { description?: string }).description
      const descriptionEn = (p as { descriptionEn?: string }).descriptionEn
      const trigramme = (p as { trigramme?: string }).trigramme
      const text = stripAccents(
        [p.nom, p.nomEn, p.marque, cat, p.taille, p.color, p.material, p.modele, p.motif, description, descriptionEn, p.sku, trigramme]
          .filter(Boolean)
          .join(' ')
      )
      return searchTerms.every(t => text.includes(t))
    })
  }

  // Si pas de filtres affichés (ex: usage dans IconiquesView), on respecte l'ordre
  // d'origine passé par le parent (sinon le tri par défaut "nouveautes" écrase l'ordre).
  if (showFilters) {
    if (tri === 'prix-asc') {
      filteredProduits.sort((a, b) => a.prix - b.prix)
    } else if (tri === 'prix-desc') {
      filteredProduits.sort((a, b) => b.prix - a.prix)
    } else if (tri === 'nouveautes') {
      filteredProduits.sort((a, b) => {
        const dateA = a.createdAt?.toMillis?.() || 0
        const dateB = b.createdAt?.toMillis?.() || 0
        return dateB - dateA
      })
    }
  }

  // Mobile: 1 ou 2 colonnes selon prop, Desktop: selon prop columns
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
  }

  // Toutes les 7 pièces (desktop + mobile), on intercale une vidéo de la chineuse
  // de la pièce précédente. Si elle n'a pas de vidéo, on prend l'article encore avant
  // (i-1, i-2…) jusqu'à en trouver une — dans la limite du bloc.
  // On rotate par chineuse pour ne pas remettre toujours la même vidéo.
  type DisplayItem =
    | { type: 'product'; data: Produit }
    | { type: 'video'; key: string; videoUrl: string; chineuseSlug: string; mobileSpan: 1 | 2 }

  const displayItems: DisplayItem[] = useMemo(() => {
    const items: DisplayItem[] = []
    // Whitelist optionnelle de trigrammes (utilisée sur /luxe pour ne garder que PS/SOI/PRI)
    const whitelist = videoTrigrammeWhitelist && videoTrigrammeWhitelist.length > 0
      ? new Set(videoTrigrammeWhitelist.map(t => t.toUpperCase()))
      : null

    // Index chineuses par trigramme (en respectant la whitelist + uniquement celles qui ont des vidéos)
    const chineuseByTrigramme = new Map<string, ChineuseLite>()
    for (const c of chineuses) {
      const trig = (c.trigramme || '').toUpperCase()
      if (!trig || c.videos.length === 0) continue
      if (whitelist && !whitelist.has(trig)) continue
      chineuseByTrigramme.set(trig, c)
    }

    // Compteur de vidéo par chineuse pour rotation (évite de remettre toujours la même)
    const videoIdxByTrigramme = new Map<string, number>()

    // Extrait le trigramme à partir du SKU (préfixe alphabétique du nom : "NAN264", "PS123"…)
    const extractTrigramme = (p: Produit): string | null => {
      const src = p.nom || p.id || ''
      const m = src.match(/^([A-Z]+)\d+/i)
      return m ? m[1].toUpperCase() : null
    }

    const blockSize = 7
    let boundaryCount = 0
    for (let i = 0; i < filteredProduits.length; i++) {
      items.push({ type: 'product', data: filteredProduits[i] })
      const isBoundary = (i + 1) % blockSize === 0
      if (!isBoundary || chineuseByTrigramme.size === 0) continue

      // Mobile : alterne 1 vidéo full-width (col-span-2) → 2 vidéos demi-largeur (col-span-1 chacune).
      // Desktop : toujours 1 vidéo par cellule.
      const wantPair = !isDesktop && (boundaryCount % 2 === 1)

      // Cherche les chineuses des pièces du bloc, du plus récent au plus ancien, sans doublons.
      const uniqueChineuses: ChineuseLite[] = []
      const seenTrigs = new Set<string>()
      for (let j = i; j >= Math.max(0, i - (blockSize - 1)); j--) {
        const trig = extractTrigramme(filteredProduits[j])
        if (!trig || seenTrigs.has(trig)) continue
        const c = chineuseByTrigramme.get(trig)
        if (!c) continue
        seenTrigs.add(trig)
        uniqueChineuses.push(c)
        if (uniqueChineuses.length >= 2) break
      }
      if (uniqueChineuses.length === 0) continue

      // Construit la liste des vidéos voulues (1 ou 2).
      const picks: { c: ChineuseLite; videoUrl: string; idx: number }[] = []
      const wanted = wantPair ? 2 : 1
      for (let k = 0; k < wanted; k++) {
        const c = uniqueChineuses[k % uniqueChineuses.length]
        // Si on retombe sur la même chineuse et qu'elle n'a qu'une vidéo, on ne peut pas faire la paire.
        if (k === 1 && c === picks[0].c && c.videos.length < 2) break
        const idx = videoIdxByTrigramme.get(c.trigramme) || 0
        videoIdxByTrigramme.set(c.trigramme, idx + 1)
        picks.push({ c, videoUrl: c.videos[idx % c.videos.length], idx })
      }

      const mobileSpan: 1 | 2 = picks.length === 2 ? 1 : 2
      for (let k = 0; k < picks.length; k++) {
        const p = picks[k]
        items.push({
          type: 'video',
          key: `v-${i}-${p.c.uid}-${p.idx}-${k}`,
          videoUrl: p.videoUrl,
          chineuseSlug: p.c.slug,
          mobileSpan,
        })
      }
      boundaryCount++
    }
    return items
  }, [filteredProduits, chineuses, videoTrigrammeWhitelist, isDesktop])

  const resetFilters = () => {
    setFilters({
      promotion: false,
      marque: [] as string[],
      prixMin: '',
      prixMax: '',
      categorie: '',
      sousCats: [] as string[],
      taille: [] as string[],
      color: [] as string[],
      material: [] as string[],
      modele: [] as string[],
      motif: [] as string[],
    })
  }

  return (
    <div>
      {/* Barre filtres/recherche/tri */}
      {showFilters && (
        <div
          className="flex items-center gap-3 md:gap-6 py-4 px-4 md:px-6"
          style={{ borderBottom: '1px solid #000' }}
        >
          <button
            onClick={() => setIsFilterOpen(true)}
            className="uppercase text-xs tracking-widest hover:opacity-50 transition whitespace-nowrap"
            style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
          >
            {t('Filtrer +', 'Filter +', lang)}
          </button>

          {/* Barre de recherche : on filtre seulement à la validation (Entrée),
              pas à chaque frappe — sinon laggy sur 3500 produits. */}
          <div className="relative flex-1 max-w-md mx-auto w-full">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  setSearchQuery(searchInput.trim())
                }
              }}
              onBlur={() => {
                if (searchInput.trim() !== searchQuery) setSearchQuery(searchInput.trim())
              }}
              placeholder={t('Rechercher', 'Search', lang)}
              className="w-full px-4 py-2 pl-9 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:border-black focus:bg-white transition-colors"
              style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: '16px' }}
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {(searchInput || searchQuery) && (
              <button
                onClick={() => { setSearchInput(''); setSearchQuery('') }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          <div className="relative whitespace-nowrap" ref={triRef}>
            <button
              onClick={() => setIsTriOpen(!isTriOpen)}
              className="uppercase text-xs tracking-widest hover:opacity-50 transition flex items-center gap-2"
              style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
            >
              {triLabels[tri]}
              <span style={{ fontSize: '8px' }}>▼</span>
            </button>
            
            {isTriOpen && (
              <div 
                className="absolute right-0 top-full mt-2 bg-white min-w-[180px]"
                style={{ border: '1px solid #000', zIndex: 100 }}
              >
                {Object.entries(triLabels).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => { setTri(value); setIsTriOpen(false); }}
                    className="block w-full text-left px-4 py-3 uppercase text-xs tracking-widest hover:bg-gray-100 transition"
                    style={{ 
                      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                      fontWeight: tri === value ? '600' : '400',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Grille produits */}
      <div className={`grid ${gridCols[columns]}`} style={{ borderLeft: '1px solid #000' }}>
        {displayItems.map((item, itemIndex) => {
          // Les 6 premières vignettes sont chargées en priorité haute (au-dessus de la ligne de flottaison
          // sur mobile 2-col et desktop 3-col) ; le reste passe en lazy pour économiser la bande passante.
          const isAboveFold = itemIndex < 6
          if (item.type === 'video') {
            const mobileSpanCls = item.mobileSpan === 1 ? 'col-span-1' : 'col-span-2'
            return (
              <Link
                key={item.key}
                href={`/nos-creatrices/${item.chineuseSlug}`}
                className={`${mobileSpanCls} lg:col-span-1 block lg:relative`}
                style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000' }}
              >
                {/* Desktop : placeholder fantôme (aspect-square + faux label) pour matcher la hauteur d'une annonce produit ; la vidéo passe en absolute par-dessus pour remplir image + label sans bande blanche. */}
                <div className="hidden lg:block invisible" aria-hidden="true">
                  <div className="aspect-square" />
                  <div className="py-2 md:py-3 px-1 md:px-2 text-center">
                    <h3
                      className="uppercase font-semibold line-clamp-2"
                      style={{
                        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                        fontSize: '10px',
                        letterSpacing: '0.03em'
                      }}
                    >
                      &nbsp;
                      <br />
                      &nbsp;
                    </h3>
                    <p
                      className="mt-1"
                      style={{
                        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                        fontSize: '11px'
                      }}
                    >
                      &nbsp;
                    </p>
                  </div>
                </div>
                {/* Mobile : flow normal en 9:16. Desktop : absolute pour couvrir TOUTE la cellule (image + label). */}
                <div className="w-full aspect-[9/16] lg:aspect-auto lg:absolute lg:inset-0 bg-white overflow-hidden">
                  <LazyAutoplayVideo src={item.videoUrl} className="w-full h-full object-cover" />
                </div>
              </Link>
            )
          }
          const produit = item.data
          return (
          <div
            key={produit.id}
            className="relative group"
            style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000' }}
          >
            <Link
              href={`/${buildProduitSlug(produit)}#titre`}
              className="block"
              onClick={() => sessionStorage.setItem('productGrid_scrollY', String(window.scrollY))}
            >
              <div className="aspect-square bg-white overflow-hidden relative">
              {produit.imageUrls?.[0] ? (
                <>
                  <img
                    src={getCloudinaryUrl(produit.imageUrls[0])}
                    srcSet={getCloudinarySrcSet(produit.imageUrls[0])}
                    sizes={CLOUDINARY_GRID_SIZES}
                    width={400}
                    height={400}
                    alt={produit.nom}
                    loading={isAboveFold ? 'eager' : 'lazy'}
                    fetchPriority={isAboveFold ? 'high' : 'auto'}
                    decoding="async"
                    className={`w-full h-full object-cover transition duration-500 ${produit.vendu ? 'opacity-50' : ''} ${produit.imageUrls[1] ? 'group-hover:opacity-0' : 'group-hover:scale-105'}`}
                  />
                  {produit.imageUrls[1] && (
                    <img
                      src={getCloudinaryUrl(produit.imageUrls[1])}
                      srcSet={getCloudinarySrcSet(produit.imageUrls[1])}
                      sizes={CLOUDINARY_GRID_SIZES}
                      width={400}
                      height={400}
                      alt={`${produit.nom} 2`}
                      loading="lazy"
                      decoding="async"
                      className={`absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition duration-500 ${produit.vendu ? 'group-hover:opacity-50' : ''}`}
                    />
                  )}
                </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    {t("Pas d'image", 'No image', lang)}
                  </div>
                )}
                {produit.vendu && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="bg-black text-white text-[10px] md:text-xs font-bold uppercase tracking-widest px-3 py-1.5" style={{ letterSpacing: '0.2em' }}>
                      {t('Vendu', 'Sold out', lang)}
                    </span>
                  </div>
                )}
                {!produit.vendu && produit.rupture && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="bg-white text-black text-[10px] md:text-xs font-bold uppercase tracking-widest px-3 py-1.5" style={{ letterSpacing: '0.2em', border: '1px solid #000' }}>
                      {t('Rupture', 'Out of stock', lang)}
                    </span>
                  </div>
                )}
              </div>

              <div className="py-2 md:py-3 px-1 md:px-2 text-center bg-white">
                {emphasizeBrand && produit.marque ? (
                  <>
                    <h3
                      className="uppercase font-bold line-clamp-1"
                      style={{
                        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                        fontSize: '14px',
                        letterSpacing: '0.04em'
                      }}
                    >
                      {produit.marque}
                    </h3>
                    <p
                      className="mt-1 uppercase line-clamp-2"
                      style={{
                        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                        fontSize: '10px',
                        letterSpacing: '0.03em',
                        color: '#666',
                        fontWeight: 400
                      }}
                    >
                      {formatDisplayTitle(produit, lang)}
                    </p>
                  </>
                ) : (
                  <>
                    <h3
                      className="uppercase font-semibold line-clamp-2"
                      style={{
                        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                        fontSize: '10px',
                        letterSpacing: '0.03em'
                      }}
                    >
                      {formatDisplayTitle(produit, lang)}
                    </h3>
                    {produit.marque && (
                      <p
                        className="mt-1 uppercase"
                        style={{
                          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                          fontSize: '10px',
                          letterSpacing: '0.05em',
                          color: '#666'
                        }}
                      >
                        {produit.marque}
                      </p>
                    )}
                  </>
                )}
                <p
                  className="mt-1"
                  style={{
                    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                    fontSize: '11px',
                    color: '#000'
                  }}
                >
                  {formatPrix(produit.prix)} €
                </p>
              </div>
            </Link>

            {/* Bouton Favori */}
            <div className="absolute top-1 right-1 md:top-2 md:right-2">
              <FavoriteButton productId={produit.id} size={20} className="md:!w-6 md:!h-6" />
            </div>
          </div>
          )
        })}
      </div>

      {/* Panel Filtres - PLEIN ÉCRAN - MOITIÉ DROITE */}
      {isFilterOpen && (
        <>
          {/* Overlay sombre sur la gauche */}
          <div 
            className="fixed inset-0 bg-black/20"
            style={{ zIndex: 99998 }}
            onClick={() => setIsFilterOpen(false)}
          />
          
          {/* Panel filtres - moitié droite */}
          <div 
            className="fixed top-0 right-0 bottom-0 w-full sm:w-1/2 bg-white flex flex-col"
            style={{ zIndex: 99999 }}
          >
            {/* Header */}
            <div 
              className="flex justify-between items-center p-6"
              style={{ borderBottom: '1px solid #000' }}
            >
              <span
                className="uppercase text-sm tracking-widest font-semibold"
                style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
              >
                {t('Filtre', 'Filter', lang)}
              </span>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="w-10 h-10 relative hover:opacity-50 transition"
              >
                <span className="absolute top-1/2 left-0 w-full h-[1px] bg-black" style={{ transform: 'rotate(45deg)' }} />
                <span className="absolute top-1/2 left-0 w-full h-[1px] bg-black" style={{ transform: 'rotate(-45deg)' }} />
              </button>
            </div>

            {/* Filtres - scrollable */}
            <div className="flex-1 overflow-y-auto">
              {(() => {
                const HELVETICA = '"Helvetica Neue", Helvetica, Arial, sans-serif'
                const AccordionHeader = ({ id, label }: { id: string; label: string }) => (
                  <button
                    type="button"
                    onClick={() => toggleSection(id)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left hover:opacity-70 transition"
                  >
                    <h4
                      className="uppercase text-xs tracking-widest font-semibold"
                      style={{ fontFamily: HELVETICA }}
                    >
                      {label}
                    </h4>
                    <span className="text-lg leading-none font-light w-4 text-right">
                      {openSections.has(id) ? '−' : '+'}
                    </span>
                  </button>
                )
                return (
                  <>
                    {/* Catégorie */}
                    {categories.length > 0 && (
                      <div style={{ borderBottom: '1px solid #000' }}>
                        <AccordionHeader id="categorie" label={t('Catégorie', 'Category', lang)} />
                        {openSections.has('categorie') && (
                          <div className="px-6 pb-6">
                            <div className="grid grid-cols-2 gap-2">
                              {categories.map((cat) => (
                                <button
                                  key={cat}
                                  onClick={() => setFilters({ ...filters, categorie: filters.categorie === cat ? '' : cat, sousCats: [], taille: [], color: [], material: [], modele: [], motif: [] })}
                                  className="py-2 px-3 text-xs uppercase tracking-wide transition"
                                  style={{
                                    fontFamily: HELVETICA,
                                    border: '1px solid #000',
                                    backgroundColor: filters.categorie === cat ? '#000' : '#fff',
                                    color: filters.categorie === cat ? '#fff' : '#000',
                                  }}
                                >
                                  {translateCategory(cat, lang)}
                                </button>
                              ))}
                            </div>
                            {/* Sous-catégories */}
                            {sousCategories.length > 1 && (
                              <div className="grid grid-cols-2 gap-2 mt-4 pt-4" style={{ borderTop: '1px solid #eee' }}>
                                {sousCategories.map((sousCat) => {
                                  const isSelected = filters.sousCats.includes(sousCat)
                                  return (
                                    <button
                                      key={sousCat}
                                      onClick={() => {
                                        const newSousCats = isSelected
                                          ? filters.sousCats.filter(s => s !== sousCat)
                                          : [...filters.sousCats, sousCat]
                                        setFilters({ ...filters, sousCats: newSousCats, taille: [], color: [], material: [], modele: [], motif: [] })
                                      }}
                                      className="py-1.5 px-3 text-xs uppercase tracking-wide transition"
                                      style={{
                                        fontFamily: HELVETICA,
                                        border: '1px solid #999',
                                        backgroundColor: isSelected ? '#555' : '#fff',
                                        color: isSelected ? '#fff' : '#555',
                                      }}
                                    >
                                      {translateCategory(sousCat, lang)}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Taille */}
                    <div style={{ borderBottom: '1px solid #000' }}>
                      <AccordionHeader id="taille" label={t('Taille', 'Size', lang)} />
                      {openSections.has('taille') && (
                        <div className="px-6 pb-6">
                          {tailles.length > 0 ? (
                            <div className="grid grid-cols-4 gap-2">
                              {tailles.map((taille) => {
                                const isSelected = !!taille && filters.taille.includes(taille)
                                return (
                                  <button
                                    key={taille}
                                    onClick={() => {
                                      if (!taille) return
                                      const next = isSelected
                                        ? filters.taille.filter(t => t !== taille)
                                        : [...filters.taille, taille]
                                      setFilters({ ...filters, taille: next })
                                    }}
                                    className="py-2 px-3 text-xs uppercase tracking-wide transition"
                                    style={{
                                      fontFamily: HELVETICA,
                                      border: '1px solid #000',
                                      backgroundColor: isSelected ? '#000' : '#fff',
                                      color: isSelected ? '#fff' : '#000',
                                    }}
                                  >
                                    {taille}
                                  </button>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500" style={{ fontFamily: HELVETICA }}>
                              {t('Aucune taille disponible', 'No size available', lang)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Marque */}
                    {marques.length > 0 && (
                      <div style={{ borderBottom: '1px solid #000' }}>
                        <AccordionHeader id="marque" label={t('Marque', 'Brand', lang)} />
                        {openSections.has('marque') && (
                          <div className="px-6 pb-6">
                            <div className="flex items-center gap-2 mb-3">
                              <input
                                type="text"
                                value={marqueSearch}
                                onChange={(e) => setMarqueSearch(e.target.value)}
                                placeholder={t('Rechercher une marque…', 'Search a brand…', lang)}
                                className="flex-1 py-2 px-3 text-xs"
                                style={{ fontFamily: HELVETICA, border: '1px solid #000' }}
                              />
                              {marquesLuxePresentes.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = luxeToutSelectionne
                                      ? filters.marque.filter(m => !marquesLuxePresentes.includes(m))
                                      : [...new Set([...filters.marque, ...marquesLuxePresentes])]
                                    setFilters({ ...filters, marque: next })
                                  }}
                                  className="py-2 px-3 text-xs uppercase tracking-wide transition whitespace-nowrap"
                                  style={{
                                    fontFamily: HELVETICA,
                                    border: '1px solid #000',
                                    backgroundColor: luxeToutSelectionne ? '#000' : '#fff',
                                    color: luxeToutSelectionne ? '#fff' : '#000',
                                  }}
                                >
                                  {t('Luxe', 'Luxury', lang)}
                                </button>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {marquesAffichees.map((marque) => {
                                const isSelected = !!marque && filters.marque.includes(marque)
                                return (
                                  <button
                                    key={marque}
                                    onClick={() => {
                                      if (!marque) return
                                      const next = isSelected
                                        ? filters.marque.filter(m => m !== marque)
                                        : [...filters.marque, marque]
                                      setFilters({ ...filters, marque: next })
                                    }}
                                    className="py-2 px-3 text-xs uppercase tracking-wide transition"
                                    style={{
                                      fontFamily: HELVETICA,
                                      border: '1px solid #000',
                                      backgroundColor: isSelected ? '#000' : '#fff',
                                      color: isSelected ? '#fff' : '#000',
                                    }}
                                  >
                                    {marque}
                                  </button>
                                )
                              })}
                              {marquesAffichees.length === 0 && (
                                <div
                                  className="col-span-2 text-xs text-center py-4"
                                  style={{ fontFamily: HELVETICA, color: '#666' }}
                                >
                                  {t('Aucune marque', 'No brand', lang)}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Prix */}
                    <div style={{ borderBottom: '1px solid #000' }}>
                      <AccordionHeader id="prix" label={t('Prix', 'Price', lang)} />
                      {openSections.has('prix') && (
                        <div className="px-6 pb-6">
                          <div className="flex gap-4 items-center">
                            <input
                              type="number"
                              placeholder="Min"
                              value={filters.prixMin}
                              onChange={(e) => setFilters({ ...filters, prixMin: e.target.value })}
                              className="w-24 py-2 px-3 text-sm"
                              style={{ fontFamily: HELVETICA, border: '1px solid #000' }}
                            />
                            <span>—</span>
                            <input
                              type="number"
                              placeholder="Max"
                              value={filters.prixMax}
                              onChange={(e) => setFilters({ ...filters, prixMax: e.target.value })}
                              className="w-24 py-2 px-3 text-sm"
                              style={{ fontFamily: HELVETICA, border: '1px solid #000' }}
                            />
                            <span className="text-sm">€</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Couleur */}
                    {couleurs.length > 0 && (
                      <div style={{ borderBottom: '1px solid #000' }}>
                        <AccordionHeader id="couleur" label={t('Couleur', 'Color', lang)} />
                        {openSections.has('couleur') && (
                          <div className="px-6 pb-6">
                            <div className="grid grid-cols-3 gap-2">
                              {couleurs.map((couleur) => {
                                const paletteEntry = COLOR_PALETTE.find(c => c.name === couleur)
                                const isSelected = !!couleur && filters.color.includes(couleur)
                                return (
                                  <button
                                    key={couleur}
                                    onClick={() => {
                                      if (!couleur) return
                                      const next = isSelected
                                        ? filters.color.filter(c => c !== couleur)
                                        : [...filters.color, couleur]
                                      setFilters({ ...filters, color: next })
                                    }}
                                    className="py-2 px-3 text-xs uppercase tracking-wide transition flex items-center gap-2"
                                    style={{
                                      fontFamily: HELVETICA,
                                      border: isSelected ? '2px solid #000' : '1px solid #000',
                                      backgroundColor: isSelected ? '#f3f4f6' : '#fff',
                                      color: '#000',
                                    }}
                                  >
                                    <span
                                      className="w-4 h-4 rounded-full flex-shrink-0"
                                      style={{
                                        background: paletteEntry?.hex || '#ccc',
                                        border: couleur === 'Blanc' || couleur === 'Écru' || couleur === 'Crème' ? '1px solid #ccc' : 'none',
                                      }}
                                    />
                                    {translateColor(couleur!, lang)}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Matière */}
                    {matieres.length > 0 && (
                      <div style={{ borderBottom: '1px solid #000' }}>
                        <AccordionHeader id="matiere" label={t('Matière', 'Material', lang)} />
                        {openSections.has('matiere') && (
                          <div className="px-6 pb-6">
                            <div className="grid grid-cols-2 gap-2">
                              {matieres.map((matiere) => {
                                const isSelected = !!matiere && filters.material.includes(matiere)
                                return (
                                  <button
                                    key={matiere}
                                    onClick={() => {
                                      if (!matiere) return
                                      const next = isSelected
                                        ? filters.material.filter(m => m !== matiere)
                                        : [...filters.material, matiere]
                                      setFilters({ ...filters, material: next })
                                    }}
                                    className="py-2 px-3 text-xs uppercase tracking-wide transition"
                                    style={{
                                      fontFamily: HELVETICA,
                                      border: '1px solid #000',
                                      backgroundColor: isSelected ? '#000' : '#fff',
                                      color: isSelected ? '#fff' : '#000',
                                    }}
                                  >
                                    {translateMaterial(matiere!, lang)}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Modèle */}
                    {modeles.length > 0 && (
                      <div style={{ borderBottom: '1px solid #000' }}>
                        <AccordionHeader id="modele" label={t('Modèle', 'Style', lang)} />
                        {openSections.has('modele') && (
                          <div className="px-6 pb-6">
                            <div className="grid grid-cols-2 gap-2">
                              {modeles.map((modele) => {
                                const isSelected = filters.modele.includes(modele)
                                return (
                                  <button
                                    key={modele}
                                    onClick={() => {
                                      const next = isSelected
                                        ? filters.modele.filter(m => m !== modele)
                                        : [...filters.modele, modele]
                                      setFilters({ ...filters, modele: next })
                                    }}
                                    className="py-2 px-3 text-xs uppercase tracking-wide transition"
                                    style={{
                                      fontFamily: HELVETICA,
                                      border: '1px solid #000',
                                      backgroundColor: isSelected ? '#000' : '#fff',
                                      color: isSelected ? '#fff' : '#000',
                                    }}
                                  >
                                    {translateModele(modele, lang)}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Motif */}
                    {motifs.length > 0 && (
                      <div style={{ borderBottom: '1px solid #000' }}>
                        <AccordionHeader id="motif" label={t('Motif', 'Pattern', lang)} />
                        {openSections.has('motif') && (
                          <div className="px-6 pb-6">
                            <div className="grid grid-cols-2 gap-2">
                              {motifs.map((motif) => {
                                const isSelected = filters.motif.includes(motif)
                                return (
                                  <button
                                    key={motif}
                                    onClick={() => {
                                      const next = isSelected
                                        ? filters.motif.filter(m => m !== motif)
                                        : [...filters.motif, motif]
                                      setFilters({ ...filters, motif: next })
                                    }}
                                    className="py-2 px-3 text-xs uppercase tracking-wide transition"
                                    style={{
                                      fontFamily: HELVETICA,
                                      border: '1px solid #000',
                                      backgroundColor: isSelected ? '#000' : '#fff',
                                      color: isSelected ? '#fff' : '#000',
                                    }}
                                  >
                                    {translateMotif(motif, lang)}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Promotion */}
                    <div style={{ borderBottom: '1px solid #000' }}>
                      <AccordionHeader id="promotion" label={t('Promotion', 'Sale', lang)} />
                      {openSections.has('promotion') && (
                        <div className="px-6 pb-6">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <div
                              className="w-5 h-5 flex items-center justify-center"
                              style={{ border: '1px solid #000' }}
                              onClick={() => setFilters({ ...filters, promotion: !filters.promotion })}
                            >
                              {filters.promotion && <span className="text-sm">✓</span>}
                            </div>
                            <span className="text-sm uppercase tracking-wide" style={{ fontFamily: HELVETICA }}>
                              {t('En promotion uniquement', 'On sale only', lang)}
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Footer sticky */}
            <div 
              className="p-6 flex gap-4"
              style={{ borderTop: '1px solid #000' }}
            >
              <button
                onClick={resetFilters}
                className="flex-1 py-3 uppercase text-xs tracking-widest transition hover:opacity-50"
                style={{
                  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                  border: '1px solid #000',
                }}
              >
                {t('Effacer', 'Clear', lang)}
              </button>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="flex-1 py-3 uppercase text-xs tracking-widest text-white transition hover:opacity-80"
                style={{
                  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                  backgroundColor: '#000',
                }}
              >
                {t('Appliquer', 'Apply', lang)}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}