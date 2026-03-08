'use client'

import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Link, Pencil, Trash2 } from 'lucide-react'

import { Vente } from '@/components/SalesList'

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
  const [activeCard, setActiveCard] = useState<string | null>(null)

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
      className="grid grid-cols-3 lg:grid-cols-6 gap-[1px] bg-black"
      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      {ventes.map((vente) => {
        const img = getImage(vente)
        const marque = getMarque(vente)
        const prix = getPrix(vente)
        const prixInitial = vente.prixInitial
        const prixBaisse = prixInitial && prixInitial !== prix && prixInitial > prix
        const isActive = activeCard === vente.id

        return (
          <div
            key={vente.id}
            className="relative bg-white cursor-pointer group"
            onClick={() => setActiveCard(isActive ? null : vente.id)}
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
                <div className="w-full h-full flex items-center justify-center">
                  <span style={{ fontSize: 9, color: '#ccc', letterSpacing: '0.1em' }}>
                    PHOTO
                  </span>
                </div>
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
              className={`absolute inset-0 bg-white/95 flex flex-col justify-between p-2 transition-opacity duration-200 ${
                isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
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
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#000' }}>{prix}€</span>
                  {prixBaisse && (
                    <span style={{ fontSize: 9, color: '#aaa', textDecoration: 'line-through' }}>
                      {prixInitial}€
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
                        onClick={(e) => { e.stopPropagation(); onAttribuer(vente) }}
                        className="p-1 rounded"
                        style={{ background: vente.isAttribue ? '#f3f4f6' : '#fef3c7' }}
                      >
                        <Link size={10} />
                      </button>
                    )}
                    {onModifierPrix && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onModifierPrix(vente) }}
                        className="p-1 rounded"
                        style={{ background: '#dbeafe' }}
                      >
                        <Pencil size={10} />
                      </button>
                    )}
                    {onSupprimer && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onSupprimer(vente) }}
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
                {prix}€{prixBaisse && <span style={{ fontSize: 8, color: '#aaa', textDecoration: 'line-through', marginLeft: 3 }}>{prixInitial}€</span>}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}