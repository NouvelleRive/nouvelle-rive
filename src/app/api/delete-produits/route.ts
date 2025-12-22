// app/api/delete-produits/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

type Reason = 'erreur' | 'produit_recupere' | 'valider_destock'

export async function POST(req: NextRequest) {
  try {
    const { productId, reason } = await req.json()
    
    let justif: Reason = 'erreur'
    if (reason === 'produit_recupere') justif = 'produit_recupere'
    if (reason === 'valider_destock') justif = 'valider_destock'

    if (!productId) {
      return NextResponse.json({ success: false, error: 'productId manquant' }, { status: 400 })
    }

    // Récupérer le produit d'abord
    const produitRef = adminDb.collection('produits').doc(String(productId))
    const produitSnap = await produitRef.get()

    if (!produitSnap.exists) {
      return NextResponse.json({ success: false, error: 'Produit non trouvé' }, { status: 404 })
    }

    // Valider destock : pas besoin d'auth (vendeuses non connectées)
    if (justif === 'valider_destock') {
      await produitRef.update({
        statut: 'retour',
        statutRecuperation: null,
        dateRetour: FieldValue.serverTimestamp(),
        derniereAction: 'retour_valide',
      })
      
      return NextResponse.json({
        success: true,
        action: 'retour',
      })
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

    const data = produitSnap.data() as any

    // Vérifier que l'utilisateur est admin ou propriétaire
    if (!isAdmin && data.chineur !== userEmail) {
    return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 403 })
  }

    // --- Traitement selon la raison ---
    // La Cloud Function se charge de la sync Square automatiquement

    if (justif === 'produit_recupere') {
      // Chineuse demande récupération
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

    } else {
      // Erreur → suppression Firestore → Cloud Function supprimera de Square
      await produitRef.delete()
      
      console.log(`✅ Produit ${productId} supprimé`)
      
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