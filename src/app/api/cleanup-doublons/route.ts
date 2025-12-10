// app/api/cleanup-doublons/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebaseAdmin'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

// Vérifier si l'utilisateur est admin
async function isAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return false
  
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    return decoded?.email === ADMIN_EMAIL
  } catch {
    return false
  }
}

// POST - Nettoyer les doublons de ventes
export async function POST(req: NextRequest) {
  try {
    // Vérifier admin
    if (!await isAdmin(req)) {
      return NextResponse.json({ success: false, error: 'Accès admin requis' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const dryRun = body.dryRun !== false // Par défaut true

    console.log(`🧹 Nettoyage des doublons (dryRun: ${dryRun})`)

    // 1. Charger toutes les ventes
    const ventesSnap = await adminDb.collection('ventes').get()
    const ventes: Array<{ id: string; [key: string]: any }> = ventesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    console.log(`📋 ${ventes.length} ventes chargées`)

    // 2. Grouper par clé prix + date (arrondie à la minute)
    const groupes = new Map<string, Array<{ id: string; [key: string]: any }>>()

    for (const vente of ventes) {
      if (!vente.prixVenteReel || !vente.dateVente) continue

      // Gérer les deux formats de date (Timestamp Firestore ou string)
      let dateObj: Date
      if (vente.dateVente && typeof vente.dateVente.toDate === 'function') {
        dateObj = vente.dateVente.toDate()
      } else {
        dateObj = new Date(vente.dateVente)
      }
      
      const dateMin = Math.floor(dateObj.getTime() / 60000)
      const key = `${vente.prixVenteReel}-${dateMin}`

      if (!groupes.has(key)) {
        groupes.set(key, [])
      }
      groupes.get(key)!.push(vente)
    }

    // 3. Identifier les doublons à supprimer
    const aSupprimer: string[] = []
    const details: Array<{ garde: any; supprime: any; prix: number }> = []

    for (const [, groupe] of groupes) {
      if (groupe.length <= 1) continue // Pas de doublon

      // Trier : priorité à isAttribue=true, puis à celles avec produitId
      groupe.sort((a, b) => {
        // Priorité 1: attribue = true
        if (a.attribue === true && b.attribue !== true) return -1
        if (b.attribue === true && a.attribue !== true) return 1
        // Priorité 2: a un produitId
        if (a.produitId && !b.produitId) return -1
        if (b.produitId && !a.produitId) return 1
        // Priorité 3: a un SKU
        if (a.sku && !b.sku) return -1
        if (b.sku && !a.sku) return 1
        return 0
      })

      // Garder le premier, supprimer les autres
      const aGarder = groupe[0]
      const doublons = groupe.slice(1)

      for (const doublon of doublons) {
        aSupprimer.push(doublon.id)
        details.push({
          garde: { id: aGarder.id, nom: aGarder.nom, sku: aGarder.sku, attribue: aGarder.attribue },
          supprime: { id: doublon.id, nom: doublon.nom, sku: doublon.sku, attribue: doublon.attribue },
          prix: doublon.prixVenteReel,
        })
      }
    }

    console.log(`🗑️ ${aSupprimer.length} doublons identifiés`)

    // 4. Supprimer si pas en mode dryRun
    let deleted = 0
    if (!dryRun && aSupprimer.length > 0) {
      const BATCH_SIZE = 500
      for (let i = 0; i < aSupprimer.length; i += BATCH_SIZE) {
        const batch = adminDb.batch()
        for (const id of aSupprimer.slice(i, i + BATCH_SIZE)) {
          batch.delete(adminDb.collection('ventes').doc(id))
          deleted++
        }
        await batch.commit()
      }
      console.log(`✅ ${deleted} doublons supprimés`)
    }

    return NextResponse.json({
      success: true,
      dryRun,
      totalVentes: ventes.length,
      doublonsIdentifies: aSupprimer.length,
      doublonsSupprimes: deleted,
      details: details.slice(0, 50), // Limiter les détails à 50 pour la lisibilité
    })

  } catch (err: any) {
    console.error('[API CLEANUP DOUBLONS]', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}