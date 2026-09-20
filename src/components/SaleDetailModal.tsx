'use client'

import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { X } from 'lucide-react'
import { formatPrix } from '@/lib/formatPrix'
import { calcMargeNette } from '@/lib/marge'
import type { Vente } from '@/components/SalesList'

// Mêmes catégories que la fiche annonce publique (ProduitClient) : pas de taille sur les bijoux.
const categoriesSansTaille = ['bijoux', "boucles d'oreilles", 'colliers', 'bracelets', 'bagues', 'lunettes', 'lunettes de soleil', 'montres', 'accessoires']

function labelCategorie(c: any): string {
  return typeof c === 'object' ? (c?.label || '') : (c || '')
}

function toDate(v: any): Date | null {
  if (!v) return null
  const d = typeof v.toDate === 'function' ? v.toDate() : new Date(v)
  return isNaN(d.getTime()) ? null : d
}

function bunny(url: string, size: number): string {
  if (!url) return ''
  if (url.includes('b-cdn.net') || url.includes('bunnycdn')) return `${url}?width=${size}`
  return url
}

function Ligne({ label, value }: { label: string; value?: any }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <p className="leading-7">
      <span className="text-gray-400 inline-block min-w-[110px]">{label}</span>
      <span className="text-gray-900">{value}</span>
    </p>
  )
}

interface Props {
  vente: Vente
  /** Doc produit déjà chargé par la grille (aucun read Firestore en plus). */
  produit?: any
  isAdmin?: boolean
  onClose: () => void
}

export default function SaleDetailModal({ vente, produit, isAdmin = false, onClose }: Props) {
  // Si la grille n'a pas déjà le produit (vue liste), on le charge une seule fois, au clic.
  const [fetched, setFetched] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (produit || !vente.produitId) return
    let annule = false
    setLoading(true)
    getDoc(doc(db, 'produits', vente.produitId))
      .then(snap => { if (!annule && snap.exists()) setFetched(snap.data()) })
      .catch(() => {})
      .finally(() => { if (!annule) setLoading(false) })
    return () => { annule = true }
  }, [vente.produitId, produit])

  const p = produit || fetched || {}

  const [zoom, setZoom] = useState<string | null>(null)

  const images: string[] = (p.imageUrls?.length ? p.imageUrls : (vente as any).imageUrls || []) as string[]
  const cat = labelCategorie(p.categorie ?? vente.categorie)
  const nom = (p.nom || vente.nom || vente.remarque || 'Vente sans nom').replace(new RegExp(`^${vente.sku}\\s*-\\s*`, 'i'), '')
  const sku = p.sku || vente.sku
  const prix = typeof vente.prixVenteReel === 'number' ? vente.prixVenteReel : (vente.prix || 0)
  const dateVente = toDate(vente.dateVente)
  const dateEntree = toDate(vente.createdAt ?? p.createdAt)
  const marge = isAdmin ? calcMargeNette(prix, p.prixAchat) : null
  const afficherTaille = !categoriesSansTaille.some(c => cat.toLowerCase().includes(c))

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-3" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b flex items-start justify-between gap-3 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">
              {sku && <span className="text-[#22209C]">{sku}</span>}{sku && <span className="text-gray-400"> · </span>}{nom}
            </h2>
            {p.marque && <p className="text-xs uppercase tracking-widest text-gray-500 mt-0.5">{p.marque}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={20} /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {/* Photos */}
          {images.length > 0 ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 mb-4">
              {images.map((url, i) => (
                <img
                  key={i}
                  src={bunny(url, 300)}
                  alt=""
                  onClick={() => setZoom(url)}
                  className="aspect-square w-full object-cover rounded-lg cursor-zoom-in hover:opacity-90"
                />
              ))}
            </div>
          ) : loading ? (
            <div className="h-24 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#22209C]" />
            </div>
          ) : null}

          {/* Vente */}
          <div className="text-sm mb-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Vente</h3>
            <Ligne label="Prix vendu" value={`${formatPrix(prix)} €`} />
            <Ligne label="Prix initial" value={vente.prixInitial && vente.prixInitial !== prix ? `${formatPrix(vente.prixInitial)} €` : undefined} />
            <Ligne label="Vendu le" value={dateVente ? format(dateVente, 'dd/MM/yyyy à HH:mm', { locale: fr }) : undefined} />
            <Ligne label="Entré le" value={dateEntree ? format(dateEntree, 'dd/MM/yyyy', { locale: fr }) : undefined} />
            <Ligne label="Chineuse" value={vente.trigramme || vente.chineur} />
            <Ligne label="Source" value={vente.source} />
            {isAdmin && <Ligne label="Prix achat" value={typeof p.prixAchat === 'number' ? `${formatPrix(p.prixAchat)} €` : undefined} />}
            {isAdmin && <Ligne label="Frais port" value={typeof p.fraisPort === 'number' ? `${formatPrix(p.fraisPort)} €` : undefined} />}
            {isAdmin && <Ligne label="Marge nette" value={marge !== null ? `${formatPrix(marge)} €` : undefined} />}
          </div>

          {/* Caractéristiques — mêmes champs que la fiche annonce */}
          <div className="text-sm mb-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Taille et caractéristiques</h3>
            <Ligne label="Marque" value={p.marque || vente.marque} />
            <Ligne label="Catégorie" value={cat} />
            <Ligne label="Matière" value={p.material} />
            <Ligne label="Composition" value={p.composition} />
            <Ligne label="Couleur" value={p.color} />
            {afficherTaille && <Ligne label="Taille" value={p.taille} />}
            <Ligne label="Modèle" value={p.modele} />
            <Ligne label="Longueur" value={p.bagLength} />
            <Ligne label="Hauteur" value={p.bagHeight} />
            <Ligne label="Origine" value={p.madeIn ? String(p.madeIn).replace(/^Made in\s+/i, '').trim() : undefined} />
            <Ligne label="État" value={p.etat} />
          </div>

          {/* Description */}
          {(p.description || vente.description) && (
            <div className="text-sm mb-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Description</h3>
              <p className="text-gray-700 whitespace-pre-line leading-relaxed">{p.description || vente.description}</p>
            </div>
          )}

          {/* Entretien */}
          {p.entretien && (
            <div className="text-sm">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Entretien</h3>
              <p className="text-gray-700 whitespace-pre-line leading-relaxed">{p.entretien}</p>
            </div>
          )}
        </div>
      </div>

      {zoom && (
        <div
          className="fixed inset-0 bg-black/90 z-[80] flex items-center justify-center p-4 cursor-zoom-out"
          onClick={(e) => { e.stopPropagation(); setZoom(null) }}
        >
          <img src={bunny(zoom, 1600)} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  )
}
