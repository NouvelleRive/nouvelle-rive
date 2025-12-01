// app/api/import-ventes-excel/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { Timestamp } from 'firebase-admin/firestore'

export async function POST(req: NextRequest) {
  try {
    const { rows } = await req.json()
    
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Aucune donnée' }, { status: 400 })
    }

    console.log(`📥 Import Excel: ${rows.length} lignes`)
    console.log('Colonnes:', Object.keys(rows[0]))

    // Charger tous les produits par SKU
    const produitsSnap = await adminDb.collection('produits').get()
    const produitsBySku = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()
    
    for (const doc of produitsSnap.docs) {
      const data = doc.data()
      if (data.sku) {
        const skuNorm = data.sku.toLowerCase().replace(/\s+/g, '')
        produitsBySku.set(skuNorm, doc)
      }
    }
    console.log(`📦 ${produitsBySku.size} produits indexés`)

    console.log(`📋 Import sans déduplication - toutes les lignes seront importées`)

    let imported = 0
    let errors = 0
    let skipped = 0

    const ventesToAdd: any[] = []
    const produitsToUpdate: { ref: FirebaseFirestore.DocumentReference; data: any }[] = []

    for (const row of rows) {
      try {
        // Trouver les colonnes - gérer les espaces insécables et variantes
        const dateStr = row['Date'] || row['date'] || ''
        const article = row['Article'] || row['article'] || ''
        
        // SKU - chercher toutes les variantes
        let sku = ''
        for (const key of Object.keys(row)) {
          if (key.toLowerCase() === 'sku') {
            sku = row[key] ? String(row[key]) : ''
            break
          }
        }
        
        // Prix - chercher toutes les variantes
        let prixStr = ''
        for (const key of Object.keys(row)) {
          const keyLower = key.toLowerCase()
          if (keyLower.includes('ventes brutes') || keyLower.includes('ventes nettes')) {
            prixStr = row[key] ? String(row[key]) : ''
            break
          }
        }
        if (!prixStr) prixStr = row['Ventes brutes'] || row['Ventes nettes'] || row['Prix'] || ''
        
        // Remarques
        let remarques = ''
        for (const key of Object.keys(row)) {
          if (key.toLowerCase() === 'remarques') {
            remarques = row[key] ? String(row[key]) : ''
            break
          }
        }
        
        // Catégorie
        let categorie = ''
        for (const key of Object.keys(row)) {
          const keyLower = key.toLowerCase()
          if (keyLower.includes('catégorie') || keyLower === 'categorie') {
            categorie = row[key] ? String(row[key]) : ''
            break
          }
        }
        
        // Transaction ID - chercher toutes les variantes avec espaces insécables
        let transactionId = ''
        for (const key of Object.keys(row)) {
          if (key.toLowerCase().includes('transaction')) {
            transactionId = row[key] ? String(row[key]) : ''
            break
          }
        }

        // Parser le prix (format français: "165,00 €")
        let prix: number | null = null
        if (prixStr) {
          const prixClean = prixStr.toString().replace(/[€\s]/g, '').replace(',', '.')
          prix = parseFloat(prixClean)
          if (isNaN(prix)) prix = null
        }

        // Skip si prix est 0 ou null (remboursements, annulations)
        if (!prix || prix <= 0) {
          console.log(`⏭️ Skip ligne sans prix: ${article}`)
          skipped++
          continue
        }

        // Parser la date - xlsx renvoie souvent des objets Date ou des strings ISO
        let dateVente: Date | null = null
        if (dateStr) {
          try {
            if (dateStr instanceof Date) {
              dateVente = dateStr
            } else if (typeof dateStr === 'string') {
              // Essayer plusieurs formats
              dateVente = new Date(dateStr)
            } else if (typeof dateStr === 'number') {
              // Excel serial date
              dateVente = new Date((dateStr - 25569) * 86400 * 1000)
            } else if (dateStr && typeof dateStr === 'object') {
              // Peut être un objet avec toISOString
              dateVente = new Date(dateStr.toString())
            }
          } catch (e) {
            console.warn(`⚠️ Erreur parsing date: ${dateStr}`, e)
          }
        }

        if (!dateVente || isNaN(dateVente.getTime())) {
          console.warn(`⚠️ Date invalide: "${dateStr}" (type: ${typeof dateStr}) | Article: ${article}`)
          errors++
          continue
        }

        // Pas de déduplication - on importe tout

        // Chercher le produit par SKU
        let produitDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null
        let foundSku: string | null = sku || null

        if (sku) {
          const skuNorm = sku.toLowerCase().replace(/\s+/g, '')
          produitDoc = produitsBySku.get(skuNorm) || null
        }

        // Si pas de SKU, essayer d'extraire du nom de l'article ou des remarques
        if (!produitDoc && !sku) {
          const textToSearch = `${article} ${remarques}`.toLowerCase()
          // Pattern: 2-4 lettres + optionnel espace + 1-4 chiffres
          const match = textToSearch.match(/\b([a-z]{2,4})\s*(\d{1,4})\b/i)
          if (match) {
            foundSku = (match[1] + match[2]).toUpperCase()
            const skuNorm = foundSku.toLowerCase()
            produitDoc = produitsBySku.get(skuNorm) || null
          }
        }

        // Créer la vente
        const venteData: any = {
          dateVente: Timestamp.fromDate(dateVente),
          prixVenteReel: prix,
          nomSquare: article,
          skuSquare: foundSku,
          remarque: remarques || null,
          categorie: categorie || null,
          transactionId: transactionId || null,
          source: 'excel',
          createdAt: Timestamp.now(),
        }

        if (produitDoc) {
          const p = produitDoc.data()
          venteData.produitId = produitDoc.id
          venteData.nom = p.nom
          venteData.sku = p.sku
          venteData.chineur = p.chineur
          venteData.chineurUid = p.chineurUid
          venteData.trigramme = p.trigramme
          venteData.prixInitial = p.prix
          venteData.attribue = true

          // Mettre à jour le produit
          const newQty = Math.max(0, (p.quantite || 1) - 1)
          const updateData: any = { quantite: newQty }
          if (newQty === 0) {
            updateData.vendu = true
            updateData.dateVente = Timestamp.fromDate(dateVente)
            updateData.prixVenteReel = prix
          }
          produitsToUpdate.push({ ref: produitDoc.ref, data: updateData })
        } else {
          venteData.produitId = null
          venteData.nom = article || remarques || 'Vente inconnue'
          venteData.sku = foundSku
          venteData.chineurUid = null
          venteData.trigramme = null
          venteData.attribue = false
        }

        ventesToAdd.push(venteData)
        imported++
      } catch (err) {
        console.error(`❌ Erreur ligne: Article="${row['Article']}" | Erreur:`, err)
        errors++
      }
    }

    // Écrire en batch
    const BATCH_SIZE = 500

    for (let i = 0; i < ventesToAdd.length; i += BATCH_SIZE) {
      const batch = adminDb.batch()
      for (const vente of ventesToAdd.slice(i, i + BATCH_SIZE)) {
        batch.set(adminDb.collection('ventes').doc(), vente)
      }
      await batch.commit()
    }

    for (let i = 0; i < produitsToUpdate.length; i += BATCH_SIZE) {
      const batch = adminDb.batch()
      for (const { ref, data } of produitsToUpdate.slice(i, i + BATCH_SIZE)) {
        batch.update(ref, data)
      }
      await batch.commit()
    }

    console.log(`✅ Import terminé: ${imported} importées, ${skipped} doublons, ${errors} erreurs`)

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors,
    })
  } catch (err: any) {
    console.error('[API IMPORT VENTES EXCEL]', err)
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    )
  }
}