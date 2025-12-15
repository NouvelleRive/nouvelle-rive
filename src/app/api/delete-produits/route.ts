// app/api/delete-produits/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { Client, Environment } from 'square'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Production,
})

type Reason = 'erreur' | 'produit_recupere' | 'valider_destock'

export async function POST(req: NextRequest) {
  try {
    const { productId, reason } = await req.json()
    
    // CORRIGÉ : reconnaître les 3 raisons
    let justif: Reason = 'erreur'
    if (reason === 'produit_recupere') justif = 'produit_recupere'
    if (reason === 'valider_destock') justif = 'valider_destock'

    if (!productId) {
      return NextResponse.json({ success: false, error: 'productId manquant' }, { status: 400 })
    }

    // --- Auth Bearer ---
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
    }
    
    let decoded
    try {
      decoded = await adminAuth.verifyIdToken(token)
    } catch (authError: any) {
      console.error('❌ Erreur vérification token:', authError?.message)
      return NextResponse.json({ success: false, error: 'Token invalide' }, { status: 401 })
    }

    const userEmail = String(decoded?.email || '')
    const isAdmin = userEmail === ADMIN_EMAIL

    // Récupérer le produit
    const produitRef = adminDb.collection('produits').doc(String(productId))
    const produitSnap = await produitRef.get()

    if (!produitSnap.exists) {
      return NextResponse.json({ success: false, error: 'Produit non trouvé' }, { status: 404 })
    }

    const data = produitSnap.data() as any

    // Vérifier que l'utilisateur est admin ou propriétaire
    if (!isAdmin && data.chineurUid !== decoded?.uid) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 403 })
    }

    // --- Traitement selon la raison ---
    if (justif === 'produit_recupere') {
      // Chineuse demande récupération → juste marquer, PAS de suppression Square
      await produitRef.update({
        statutRecuperation: 'aRecuperer',
        dateDemandeRecuperation: FieldValue.serverTimestamp(),
        derniereAction: 'demande_recuperation',
      })
      
      console.log(`✅ Produit ${productId} en attente de validation vendeuse`)
      
      return NextResponse.json({
        success: true,
        action: 'demande_recuperation',
      })

    } else if (justif === 'valider_destock') {
      // Vendeuse valide → supprimer Square + statut retour
      const squareIds: string[] = []
      if (data?.variationId) squareIds.push(String(data.variationId))
      if (data?.catalogObjectId) squareIds.push(String(data.catalogObjectId))
      if (data?.itemId) squareIds.push(String(data.itemId))

      if (squareIds.length > 0) {
        try {
          await squareClient.catalogApi.batchDeleteCatalogObjects({ objectIds: squareIds })
          console.log('✅ Square: supprimé', squareIds)
        } catch (squareError: any) {
          console.error('Square delete error:', squareError?.message)
        }
      }

      await produitRef.update({
        statut: 'retour',
        statutRecuperation: null,
        dateRetour: FieldValue.serverTimestamp(),
        derniereAction: 'retour_valide',
      })
      
      console.log(`✅ Produit ${productId} déstocké et validé`)
      
      return NextResponse.json({
        success: true,
        action: 'retour',
      })

    } else {
      // Erreur → suppression totale Square + Firestore
      const squareIds: string[] = []
      if (data?.variationId) squareIds.push(String(data.variationId))
      if (data?.catalogObjectId) squareIds.push(String(data.catalogObjectId))
      if (data?.itemId) squareIds.push(String(data.itemId))

      if (squareIds.length > 0) {
        try {
          await squareClient.catalogApi.batchDeleteCatalogObjects({ objectIds: squareIds })
          console.log('✅ Square: supprimé', squareIds)
        } catch (squareError: any) {
          console.error('Square delete error:', squareError?.message)
        }
      }

      await produitRef.delete()
      
      console.log(`✅ Produit ${productId} supprimé définitivement`)
      
      return NextResponse.json({
        success: true,
        action: 'delete',
      })
    }

  } catch (e: any) {
    console.error('❌ [API DELETE PRODUITS]', e?.message || e)
    return NextResponse.json(
      { success: false, error: e?.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}