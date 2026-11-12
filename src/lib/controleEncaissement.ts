// src/lib/controleEncaissement.ts
// Contrôle « facturé = encaissé » avant de payer les chineuses.
//
// Facturé  = ce que la facture chineuse met dans « Lot de pièces vintage »
//            (prix encaissé enregistré sur chaque vente, cf. lib/remiseOperation).
// Encaissé = montant de la ligne correspondante dans la commande Square
//            (après remises de ligne : opération, code promo…).
// Rapprochement exact vente ↔ ligne Square par `orderId` + `lineItemUid`
// (ids déterministes des ventes). Les ventes sans commande Square (familiale,
// manuelle, eBay…) sont listées à part : rien à comparer.
import { prixEncaisse, type VenteFacturable } from '@/lib/remiseOperation'

export type VenteControle = VenteFacturable & {
  id: string
  sku?: string | null
  trigramme?: string | null
  orderId?: string | null
  lineItemUid?: string | null
}

export type LigneSquare = { orderId?: string; uid?: string; montant: number }

export type Ecart = { venteId: string; sku: string; facture: number; encaisse: number | null; raison: string }

export type ControleChineuse = {
  trigramme: string
  facture: number
  encaisse: number
  horsSquare: number
  ecarts: Ecart[]
}

const TOLERANCE = 0.01

export function controlerEncaissement(ventes: VenteControle[], lignes: LigneSquare[]): ControleChineuse[] {
  const parLigne = new Map<string, number>()
  for (const l of lignes) if (l.orderId && l.uid) parLigne.set(`${l.orderId}_${l.uid}`, l.montant)

  const parTri = new Map<string, ControleChineuse>()
  for (const v of ventes) {
    const tri = (v.trigramme || '?').toUpperCase()
    if (!parTri.has(tri)) parTri.set(tri, { trigramme: tri, facture: 0, encaisse: 0, horsSquare: 0, ecarts: [] })
    const c = parTri.get(tri)!
    const facture = prixEncaisse(v)
    if (!v.orderId) { c.horsSquare += facture; continue }
    c.facture += facture
    const encaisse = v.lineItemUid ? parLigne.get(`${v.orderId}_${v.lineItemUid}`) : undefined
    if (encaisse === undefined) {
      c.ecarts.push({ venteId: v.id, sku: v.sku || '', facture, encaisse: null, raison: 'ligne Square introuvable' })
      continue
    }
    c.encaisse += encaisse
    if (Math.abs(encaisse - facture) > TOLERANCE) {
      c.ecarts.push({ venteId: v.id, sku: v.sku || '', facture, encaisse, raison: encaisse < facture ? 'encaissé inférieur (code promo ?)' : 'encaissé supérieur' })
    }
  }
  return Array.from(parTri.values())
}
