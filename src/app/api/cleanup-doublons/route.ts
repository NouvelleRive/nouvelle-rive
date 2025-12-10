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
    // ET dont le nom/remarque correspond au SKU ou trigramme de la vente attribuée
    const aSupprimer: string[] = []
    const details: Array<{ garde: any; supprime: any; prix: number }> = []

    // Fonction pour vérifier si le nom de la vente non attribuée correspond à la vente attribuée
    const isRealDoublon = (attribuee: any, nonAttribuee: any): boolean => {
      const nomNonAttribuee = (nonAttribuee.nom || nonAttribuee.remarque || '').toLowerCase()
      const skuAttribuee = (attribuee.sku || '').toLowerCase()
      const trigrammeAttribuee = (attribuee.trigramme || '').toLowerCase()
      
      // Extraire le code du SKU (lettres + chiffres, ex: "ANA104" -> "ana104")
      const skuMatch = skuAttribuee.match(/^([a-z]+)(\d+)/i)
      const skuLetters = skuMatch ? skuMatch[1].toLowerCase() : ''
      const skuNumbers = skuMatch ? skuMatch[2] : ''
      
      // Vérifier si le nom contient le SKU complet
      if (skuAttribuee && nomNonAttribuee.includes(skuAttribuee)) return true
      
      // Vérifier si le nom contient le trigramme + numéro (ex: "an104" dans "anashi an104")
      if (skuLetters && skuNumbers) {
        // Chercher pattern: lettres suivies des chiffres (avec ou sans espace)
        const pattern = new RegExp(`${skuLetters}\\s*${skuNumbers}`, 'i')
        if (pattern.test(nomNonAttribuee)) return true
      }
      
      // Vérifier si le nom contient le trigramme au début (ex: "nr trench" pour NR1)
      if (trigrammeAttribuee && trigrammeAttribuee.length >= 2) {
        if (nomNonAttribuee.startsWith(trigrammeAttribuee + ' ')) return true
      }
      
      // Vérifier descriptions génériques qui matchent souvent (ex: "PIECE UNIQUE DIVERS")
      if (nomNonAttribuee.includes('piece unique') || nomNonAttribuee.includes('divers')) return true
      
      return false
    }

    for (const [, groupe] of groupes) {
      if (groupe.length <= 1) continue // Pas de doublon possible

      // Séparer attribuées et non attribuées
      const attribuees = groupe.filter(v => v.attribue === true)
      const nonAttribuees = groupe.filter(v => v.attribue !== true)

      // Si on a au moins une attribuée ET au moins une non attribuée
      if (attribuees.length > 0 && nonAttribuees.length > 0) {
        for (const nonAttribuee of nonAttribuees) {
          // Chercher une vente attribuée qui correspond vraiment
          const matchingAttribuee = attribuees.find(a => isRealDoublon(a, nonAttribuee))
          
          if (matchingAttribuee) {
            aSupprimer.push(nonAttribuee.id)
            details.push({
              garde: { id: matchingAttribuee.id, nom: matchingAttribuee.nom, sku: matchingAttribuee.sku, attribue: true },
              supprime: { id: nonAttribuee.id, nom: nonAttribuee.nom, sku: nonAttribuee.sku, attribue: false },
              prix: nonAttribuee.prixVenteReel,
            })
          }
        }
      }
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