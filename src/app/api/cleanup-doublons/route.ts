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
    // RÈGLE 1 : Ventes avec MÊME SKU + même prix + même jour = doublon (garder 1)
    // RÈGLE 2 : Vente NON attribuée avec doublon ATTRIBUÉ correspondant
    const aSupprimer: string[] = []
    const dejaSupprimes = new Set<string>() // Éviter de supprimer deux fois
    const details: Array<{ garde: any; supprime: any; prix: number; raison: string }> = []

    // Table de correspondance nom chineuse → trigrammes possibles
    const chineuseToTrigrammes: Record<string, string[]> = {
      'aerea': ['AE'],
      'age': ['AGE'],
      'aime': ['AIM'],
      'alisa': ['ACAY'],
      'cayoo': ['ACAY'],
      'anashi': ['ANA', 'AN'],
      'archive': ['ARC'],
      'bonage': ['BON'],
      'brillante': ['BRI'],
      'brujas': ['BRU'],
      'cameleon': ['CAM'],
      'cent-neuf': ['CN'],
      'equine': ['EQU'],
      'cozines': ['COZ'],
      'coz': ['COZ'],
      'dark': ['DV'],
      'vintage': ['DV', 'MV', 'PV', 'TPV'], // Attention: vintage peut être plusieurs
      'diabolo': ['DM'],
      'menthe': ['DM'],
      'frusques': ['FRU'],
      'ines': ['IP'],
      'pineau': ['IP'],
      'maison': ['MB'],
      'beguin': ['MB'],
      'maki': ['MAK'],
      'mission': ['MV', 'MIS'],
      'muse': ['MUS', 'MR'],
      'rebelle': ['MUS', 'MR'],
      'nan': ['NG'],
      'goldies': ['NG'],
      'nouvelle': ['NR'],
      'rive': ['NR'],
      'pardon': ['PP'],
      'personal': ['PS'],
      'seller': ['PS'],
      'porte': ['POR'],
      'prestanx': ['PRE'],
      'pristini': ['PRI'],
      'rashhiiid': ['RAS'],
      'sergio': ['ST'],
      'tacchineur': ['ST'],
      'soir': ['SOI'],
      'strass': ['STRC'],
      'chronique': ['STRC'],
      'tete': ['TDO'],
      'orange': ['TDO'],
      'dorange': ['TDO'],
      'parisian': ['PV', 'TPV'],
    }

    // Fonction pour extraire les trigrammes possibles d'un nom
    const extractTrigrammesFromName = (nom: string): string[] => {
      const nomLower = nom.toLowerCase()
      const trigrammes: string[] = []
      
      for (const [keyword, tris] of Object.entries(chineuseToTrigrammes)) {
        if (nomLower.includes(keyword)) {
          trigrammes.push(...tris)
        }
      }
      
      return [...new Set(trigrammes)] // Dédupliquer
    }

    // Fonction pour vérifier si le nom de la vente non attribuée correspond à la vente attribuée
    const isRealDoublon = (attribuee: any, nonAttribuee: any): boolean => {
      const nomNonAttribuee = (nonAttribuee.nom || nonAttribuee.remarque || '').toLowerCase()
      const skuNonAttribuee = (nonAttribuee.sku || '').toLowerCase()
      const skuAttribuee = (attribuee.sku || '').toLowerCase()
      const trigrammeAttribuee = (attribuee.trigramme || '').toLowerCase()
      const nomAttribuee = (attribuee.nom || '').toLowerCase()
      
      // Vérifier si les SKUs se contiennent mutuellement (ex: AN109 dans ANA109)
      if (skuAttribuee && skuNonAttribuee) {
        if (skuAttribuee.includes(skuNonAttribuee) || skuNonAttribuee.includes(skuAttribuee)) {
          return true
        }
      }
      
      // Vérifier via la table de correspondance chineuse → trigramme
      const trigrammesFromNom = extractTrigrammesFromName(nomNonAttribuee)
      if (trigrammeAttribuee && trigrammesFromNom.length > 0) {
        if (trigrammesFromNom.some(t => t.toLowerCase() === trigrammeAttribuee)) {
          return true
        }
      }
      
      // Vérifier si les noms (après le SKU) sont identiques ou très similaires
      // Ex: "BRI2 - Briquet CRAMEUSE DE FAF" vs "Briquet - Briquet CRAMEUSE DE FAF"
      const nomSansSkuAttribuee = nomAttribuee.replace(/^[a-z0-9_\-\s]+\s*-\s*/i, '').trim()
      const nomSansSkuNonAttribuee = nomNonAttribuee.replace(/^[a-z0-9_\-\s]+\s*-\s*/i, '').trim()
      if (nomSansSkuAttribuee && nomSansSkuNonAttribuee && nomSansSkuAttribuee === nomSansSkuNonAttribuee) {
        return true
      }
      
      // Extraire le code du SKU (lettres + chiffres, ex: "ANA104" -> "ana", "104")
      const skuMatch = skuAttribuee.match(/^([a-z]+)(\d+)/i)
      const skuLetters = skuMatch ? skuMatch[1].toLowerCase() : ''
      const skuNumbers = skuMatch ? skuMatch[2] : ''
      
      // Vérifier si le nom contient le SKU complet
      if (skuAttribuee && nomNonAttribuee.includes(skuAttribuee)) return true
      
      // Vérifier si le nom contient le trigramme + numéro (ex: "an104" dans "anashi an104")
      if (skuLetters && skuNumbers) {
        // Pattern plus souple : lettres (2-4) suivies des chiffres
        const pattern = new RegExp(`\\b${skuLetters.substring(0, 2)}\\w*\\s*${skuNumbers}\\b`, 'i')
        if (pattern.test(nomNonAttribuee)) return true
        
        // Aussi vérifier le SKU de la vente non attribuée
        if (skuNonAttribuee) {
          const skuNonMatch = skuNonAttribuee.match(/^([a-z]+)(\d+)/i)
          if (skuNonMatch && skuNonMatch[2] === skuNumbers) {
            // Même numéro, lettres similaires (ex: AN vs ANA)
            const nonLetters = skuNonMatch[1].toLowerCase()
            if (skuLetters.startsWith(nonLetters) || nonLetters.startsWith(skuLetters)) {
              return true
            }
          }
        }
      }
      
      // Vérifier si le nom contient le trigramme (ex: "pristini" contient "pri")
      if (trigrammeAttribuee && trigrammeAttribuee.length >= 2) {
        // Au début du nom
        if (nomNonAttribuee.startsWith(trigrammeAttribuee + ' ')) return true
        // Ou dans un mot du nom (ex: "fourrure pristini" contient "pri" dans "pristini")
        const words = nomNonAttribuee.split(/\s+/)
        for (const word of words) {
          if (word.includes(trigrammeAttribuee) && word.length <= trigrammeAttribuee.length + 5) {
            return true
          }
        }
      }
      
      // Vérifier descriptions génériques qui matchent souvent
      if (nomNonAttribuee.includes('piece unique') || nomNonAttribuee.includes('divers')) return true
      
      return false
    }

    for (const [, groupe] of groupes) {
      if (groupe.length <= 1) continue // Pas de doublon possible

      // ÉTAPE 1 : Chercher les doublons avec MÊME SKU (le plus évident)
      const parSku = new Map<string, any[]>()
      for (const v of groupe) {
        if (v.sku) {
          const skuNorm = v.sku.toLowerCase().trim()
          if (!parSku.has(skuNorm)) parSku.set(skuNorm, [])
          parSku.get(skuNorm)!.push(v)
        }
      }
      
      for (const [sku, ventesMemeSku] of parSku) {
        if (ventesMemeSku.length > 1) {
          // Garder la première, supprimer les autres
          const aGarder = ventesMemeSku[0]
          for (let i = 1; i < ventesMemeSku.length; i++) {
            const doublon = ventesMemeSku[i]
            if (!dejaSupprimes.has(doublon.id)) {
              aSupprimer.push(doublon.id)
              dejaSupprimes.add(doublon.id)
              details.push({
                garde: { id: aGarder.id, nom: aGarder.nom, sku: aGarder.sku, attribue: aGarder.attribue },
                supprime: { id: doublon.id, nom: doublon.nom, sku: doublon.sku, attribue: doublon.attribue },
                prix: doublon.prixVenteReel,
                raison: `Même SKU: ${sku.toUpperCase()}`,
              })
            }
          }
        }
      }

      // ÉTAPE 2 : Chercher les ventes non attribuées qui matchent une attribuée
      const attribuees = groupe.filter(v => v.attribue === true && !dejaSupprimes.has(v.id))
      const nonAttribuees = groupe.filter(v => v.attribue !== true && !dejaSupprimes.has(v.id))

      if (attribuees.length > 0 && nonAttribuees.length > 0) {
        for (const nonAttribuee of nonAttribuees) {
          if (dejaSupprimes.has(nonAttribuee.id)) continue
          
          const matchingAttribuee = attribuees.find(a => isRealDoublon(a, nonAttribuee))
          
          if (matchingAttribuee) {
            aSupprimer.push(nonAttribuee.id)
            dejaSupprimes.add(nonAttribuee.id)
            details.push({
              garde: { id: matchingAttribuee.id, nom: matchingAttribuee.nom, sku: matchingAttribuee.sku, attribue: true },
              supprime: { id: nonAttribuee.id, nom: nonAttribuee.nom, sku: nonAttribuee.sku, attribue: false },
              prix: nonAttribuee.prixVenteReel,
              raison: 'Non attribué → Attribué',
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