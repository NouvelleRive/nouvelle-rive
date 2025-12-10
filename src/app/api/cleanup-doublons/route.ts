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
    const mois = body.mois || null // Format: "11-2025" pour novembre 2025

    console.log(`🧹 Nettoyage des doublons (dryRun: ${dryRun}, mois: ${mois || 'tous'})`)

    // 1. Charger toutes les ventes
    const ventesSnap = await adminDb.collection('ventes').get()
    let ventes: Array<{ id: string; [key: string]: any }> = ventesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    console.log(`📋 ${ventes.length} ventes chargées`)

    // Filtrer par mois si spécifié
    if (mois) {
      const [m, y] = mois.split('-').map(Number)
      ventes = ventes.filter(v => {
        if (!v.dateVente) return false
        const dateObj = v.dateVente.toDate ? v.dateVente.toDate() : new Date(v.dateVente)
        return dateObj.getMonth() + 1 === m && dateObj.getFullYear() === y
      })
      console.log(`📅 ${ventes.length} ventes pour ${mois}`)
    }

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
      
      // Arrondir à la JOURNÉE (pas la minute) pour détecter les doublons
      const dateJour = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`
      const key = `${vente.prixVenteReel}-${dateJour}`

      if (!groupes.has(key)) {
        groupes.set(key, [])
      }
      groupes.get(key)!.push(vente)
    }

    // 3. Identifier les doublons à supprimer
    // RÈGLE : Ne supprimer QUE les ventes NON attribuées qui ont un doublon ATTRIBUÉ
    const aSupprimer: string[] = []
    const details: Array<{ garde: any; supprime: any; prix: number }> = []

    for (const [, groupe] of groupes) {
      if (groupe.length <= 1) continue // Pas de doublon possible

      // Séparer attribuées et non attribuées
      const attribuees = groupe.filter(v => v.attribue === true)
      const nonAttribuees = groupe.filter(v => v.attribue !== true)

      // Si on a au moins une attribuée ET au moins une non attribuée
      // → Les non attribuées sont des doublons à supprimer
      if (attribuees.length > 0 && nonAttribuees.length > 0) {
        const aGarder = attribuees[0] // On garde l'attribuée

        for (const doublon of nonAttribuees) {
          aSupprimer.push(doublon.id)
          details.push({
            garde: { id: aGarder.id, nom: aGarder.nom, sku: aGarder.sku, attribue: true },
            supprime: { id: doublon.id, nom: doublon.nom, sku: doublon.sku, attribue: false },
            prix: doublon.prixVenteReel,
          })
        }
      }
      // Si toutes sont attribuées ou toutes non attribuées → pas de doublon à supprimer
    }

    console.log(`🗑️ ${aSupprimer.length} doublons identifiés (ventes non attribuées avec doublon attribué)`)

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
      mois: mois || 'tous',
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