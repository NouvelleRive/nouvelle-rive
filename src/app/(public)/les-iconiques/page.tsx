'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { useLang, t } from '@/lib/i18n'

type IconiqueLite = {
  id: string
  slug: string
  nom: string
  nomEn: string
  pourquoiMust: string
  pourquoiMustEn: string
  imageUrl: string
  ordre: number
}

const fontHelvetica = '"Helvetica Neue", Helvetica, Arial, sans-serif'

export default function LesIconiquesPage() {
  const lang = useLang()
  const [iconiques, setIconiques] = useState<IconiqueLite[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    async function fetchIconiques() {
      try {
        const snap = await getDocs(collection(db, 'iconiques'))
        const data: IconiqueLite[] = []
        snap.forEach((doc) => {
          const d = doc.data()
          if (d.displayOnWebsite === false) return
          if ((d.type || 'vintage') !== 'vintage') return
          data.push({
            id: doc.id,
            slug: d.slug || doc.id,
            nom: d.nom || '',
            nomEn: d.nomEn || '',
            pourquoiMust: d.pourquoiMust || '',
            pourquoiMustEn: d.pourquoiMustEn || '',
            imageUrl: Array.isArray(d.images) && d.images.length > 0 ? d.images[0] : '',
            ordre: d.ordre || 999,
          })
        })
        data.sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
        if (!cancelled) setIconiques(data)
      } catch (err) {
        console.error('Erreur fetch iconiques vintage:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchIconiques()
    return () => { cancelled = true }
  }, [])

  const q = search.toLowerCase()
  const filtered = iconiques.filter(i =>
    !q ||
    i.nom.toLowerCase().includes(q) ||
    i.nomEn.toLowerCase().includes(q) ||
    i.pourquoiMust.toLowerCase().includes(q) ||
    i.pourquoiMustEn.toLowerCase().includes(q)
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="uppercase tracking-widest" style={{ fontFamily: fontHelvetica, fontSize: '11px' }}>
          {t('Chargement...', 'Loading...', lang)}
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-6 py-20" style={{ fontFamily: fontHelvetica }}>
        <h1
          id="titre"
          style={{
            fontSize: 'clamp(28px, 8vw, 120px)',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 0.95,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {lang === 'en' ? <>VINTAGE<br />ICONICS</> : <>LES ICONIQUES<br />DU VINTAGE</>}
        </h1>
      </div>
      <div className="w-full border-t border-black" />

      {/* Recherche */}
      <div className="py-6 px-6" style={{ borderBottom: '1px solid #000' }}>
        <div className="max-w-md mx-auto relative">
          <input
            type="text"
            placeholder={t('Rechercher...', 'Search...', lang)}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full py-3 px-4 pr-12 text-xs tracking-widest bg-transparent outline-none"
            style={{ fontFamily: fontHelvetica, border: '1px solid #000' }}
          />
          <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <p className="text-center mt-4 uppercase" style={{ fontFamily: fontHelvetica, fontSize: '10px', color: '#666' }}>
          {lang === 'en'
            ? `${filtered.length} icon${filtered.length > 1 ? 's' : ''}`
            : `${filtered.length} iconique${filtered.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {/* Grille — format portrait 3:4 comme nos-creatrices */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" style={{ borderLeft: '1px solid #000' }}>
        {filtered.map((i) => (
          <Link
            key={i.id}
            href={`/les-iconiques/${i.slug}`}
            className="group"
            style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000' }}
          >
            <div className="aspect-[3/4] bg-gray-100 overflow-hidden relative">
              {i.imageUrl ? (
                <img
                  src={i.imageUrl}
                  alt={lang === 'en' && i.nomEn ? i.nomEn : i.nom}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <p className="text-gray-400 text-xs uppercase tracking-wider">{t('Image à venir', 'Image coming soon', lang)}</p>
                </div>
              )}
            </div>
            <div className="py-4 px-3 text-center bg-white">
              <h2
                className="uppercase font-semibold whitespace-pre-line"
                style={{ fontFamily: fontHelvetica, fontSize: '11px', lineHeight: 1.3 }}
              >
                {lang === 'en' && i.nomEn ? i.nomEn : i.nom}
              </h2>
              {(lang === 'en' && i.pourquoiMustEn ? i.pourquoiMustEn : i.pourquoiMust) && (
                <p
                  className="mt-1 uppercase line-clamp-2"
                  style={{ fontFamily: fontHelvetica, fontSize: '10px', color: '#0000FF', letterSpacing: '0.15em' }}
                >
                  {lang === 'en' && i.pourquoiMustEn ? i.pourquoiMustEn : i.pourquoiMust}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-20 text-center">
          <p className="uppercase tracking-widest text-gray-400" style={{ fontFamily: fontHelvetica, fontSize: '11px' }}>
            {t('Aucun résultat', 'No results', lang)}
          </p>
        </div>
      )}
    </main>
  )
}
