'use client'

import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Link, Pencil, Trash2, X } from 'lucide-react'

import { Vente, formatPrix } from '@/components/SalesList'

interface SalesGridProps {
  ventes: Vente[]
  isAdmin?: boolean
  onAttribuer?: (vente: Vente) => void
  onModifierPrix?: (vente: Vente) => void
  onSupprimer?: (vente: Vente) => void
}

function getBunnyUrl(url: string, size = 400): string {
  if (!url) return ''
  // Bunny CDN : ajouter ?width=xxx
  if (url.includes('b-cdn.net') || url.includes('bunnycdn')) {
    return `${url}?width=${size}&height=${size}&aspect_ratio=1:1`
  }
  // Cloudinary legacy
  if (url.includes('cloudinary.com')) {
    return url.replace('/upload/', `/upload/w_${size},h_${size},c_fill,q_auto/`)
  }
  return url
}

export default function SalesGrid({
  ventes,
  isAdmin = false,
  onAttribuer,
  onModifierPrix,
  onSupprimer,
}: SalesGridProps) {
  const [enriched, setEnriched] = useState<Map<string, { imageUrls: string[]; marque: string }>>(new Map())
  const [zoomedImg, setZoomedImg] = useState<string | null>(null)

  // Fetch images pour les ventes sans imageUrls
  useEffect(() => {
    const toFetch = ventes.filter(v => v.produitId && !v.imageUrls?.length)
    if (toFetch.length === 0) return

    const fetchAll = async () => {
      const results = new Map<string, { imageUrls: string[]; marque: string }>()
      await Promise.all(
        toFetch.map(async (v) => {
          if (!v.produitId) return
          try {
            const snap = await getDoc(doc(db, 'produits', v.produitId))
            if (snap.exists()) {
              const d = snap.data()
              results.set(v.id, {
                imageUrls: d.imageUrls || [],
                marque: d.marque || '',
              })
            }
          } catch {}
        })
      )
      setEnriched(results)
    }

    fetchAll()
  }, [ventes])

  const getImage = (v: Vente): string => {
    const urls = v.imageUrls?.length ? v.imageUrls : enriched.get(v.id)?.imageUrls || []
    return urls[0] ? getBunnyUrl(urls[0], 400) : ''
  }

  const getRawImage = (v: Vente): string => {
    const urls = v.imageUrls?.length ? v.imageUrls : enriched.get(v.id)?.imageUrls || []
    return urls[0] || ''
  }

  const getMarque = (v: Vente): string => {
    return v.marque || enriched.get(v.id)?.marque || ''
  }

  const getPrix = (v: Vente): number => {
    return typeof v.prixVenteReel === 'number' ? v.prixVenteReel : (v.prix || 0)
  }

  const getDate = (v: Vente): string => {
    if (!v.dateVente) return ''
    const d = typeof (v.dateVente as any).toDate === 'function'
      ? (v.dateVente as any).toDate()
      : new Date(v.dateVente as string)
    return isNaN(d.getTime()) ? '' : format(d, 'dd MMM', { locale: fr })
  }

  return (
    <div
      className="grid grid-cols-3 lg:grid-cols-6 gap-[1px] bg-gray-200"
      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      {ventes.map((vente) => {
        const img = getImage(vente)
        const rawImg = getRawImage(vente)
        const marque = getMarque(vente)
        const prix = getPrix(vente)
        const prixInitial = vente.prixInitial
        const prixBaisse = prixInitial && prixInitial !== prix && prixInitial > prix

        return (
          <div
            key={vente.id}
            onClick={() => rawImg && setZoomedImg(rawImg)}
            className="relative bg-white cursor-zoom-in group block"
          >
            {/* Photo */}
            <div className="aspect-square overflow-hidden bg-gray-100">
              {img ? (
                <img
                  src={img}
                  alt={vente.nom || ''}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full bg-gray-100" />
              )}
            </div>

            {/* Dot attribution (admin) */}
            {isAdmin && (
              <span
                className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full"
                style={{ background: vente.isAttribue ? '#22c55e' : '#f59e0b' }}
              />
            )}

            {/* SKU */}
            {(vente.sku || vente.trigramme) && (
              <span
                className="absolute top-1.5 right-1.5 bg-white/90 px-1"
                style={{ fontSize: 8, letterSpacing: '0.1em', fontWeight: 600 }}
              >
                {vente.sku || vente.trigramme}
              </span>
            )}

            {/* Overlay infos au tap/hover */}
            <div
              className="absolute inset-0 bg-white/95 flex flex-col justify-between p-2 transition-opacity duration-200 opacity-0 group-hover:opacity-100"
            >
              <div>
                {marque && (
                  <p style={{ fontSize: 9, letterSpacing: '0.12em', fontWeight: 700, textTransform: 'uppercase' }}>
                    {marque}
                  </p>
                )}
                <p style={{ fontSize: 8, letterSpacing: '0.05em', color: '#555', marginTop: 2 }}
                   className="line-clamp-2">
                  {vente.nom?.replace(/^[A-Z]+\d+\s*[-–]\s*/i, '') || vente.sku}
                </p>
              </div>

              <div>
                <div className="flex items-baseline gap-1">
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#000' }}>{formatPrix(prix)}€</span>
                  {prixBaisse && (
                    <span style={{ fontSize: 9, color: '#aaa', textDecoration: 'line-through' }}>
                      {formatPrix(prixInitial)}€
                    </span>
                  )}
                </div>
                {getDate(vente) && (
                  <p style={{ fontSize: 8, color: '#aaa', letterSpacing: '0.05em' }}>{getDate(vente)}</p>
                )}

                {/* Actions admin */}
                {isAdmin && (
                  <div className="flex gap-1 mt-1">
                    {onAttribuer && (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAttribuer(vente) }}
                        className="p-1 rounded"
                        style={{ background: vente.isAttribue ? '#f3f4f6' : '#fef3c7' }}
                      >
                        <Link size={10} />
                      </button>
                    )}
                    {onModifierPrix && (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onModifierPrix(vente) }}
                        className="p-1 rounded"
                        style={{ background: '#dbeafe' }}
                      >
                        <Pencil size={10} />
                      </button>
                    )}
                    {onSupprimer && (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSupprimer(vente) }}
                        className="p-1 rounded"
                        style={{ background: '#fee2e2' }}
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Prix + Marque permanents */}
            <div className="absolute bottom-0 left-0 right-0 bg-white/90 flex items-center justify-between border-t border-black/10"
              style={{ padding: '2px 4px' }}>
              <span style={{ fontSize: 8, letterSpacing: '0.1em', fontWeight: 600, textTransform: 'uppercase', color: '#555' }}>{marque}</span>
              <span style={{ fontSize: 10, fontWeight: 700 }}>
                {formatPrix(prix)}€{prixBaisse && <span style={{ fontSize: 8, color: '#aaa', textDecoration: 'line-through', marginLeft: 3 }}>{formatPrix(prixInitial)}€</span>}
              </span>
            </div>
          </div>
        )
      })}

      {zoomedImg && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomedImg(null)}
        >
          <img
            src={zoomedImg.includes('b-cdn.net') || zoomedImg.includes('bunnycdn') ? `${zoomedImg}?width=1600` : zoomedImg}
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setZoomedImg(null)}
            className="absolute top-4 right-4 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg"
            aria-label="Fermer"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  )
}