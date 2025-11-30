// app/api/ventes/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebaseAdmin'

/**
 * GET - Récupérer toutes les ventes (ou filtrées par chineuse)
 * Query: ?uid=xxx (optionnel - si absent, retourne toutes les ventes)
 */
export async function GET(req: NextRequest) {
  try {
    const uid = req.nextUrl.searchParams.get('uid')
    const startDate = req.nextUrl.searchParams.get('startDate')
    const endDate = req.nextUrl.searchParams.get('endDate')

    let query: FirebaseFirestore.Query = adminDb.collection('ventes')
    
    if (uid) {
      query = query.where('chineurUid', '==', uid)
    }
    
    query = query.orderBy('dateVente', 'desc')
    
    const ventesSnap = await query.get()

    let ventes = ventesSnap.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        dateVente: data.dateVente?.toDate?.()?.toISOString() || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        attribueAt: data.attribueAt?.toDate?.()?.toISOString() || null,
        isAttribue: data.attribue !== false && data.produitId !== null,
      }
    })

    // Filtrer par date si demandé
    if (startDate) {
      const start = new Date(startDate)
      ventes = ventes.filter(v => v.dateVente && new Date(v.dateVente) >= start)
    }
    if (endDate) {
      const end = new Date(endDate)
      ventes = ventes.filter(v => v.dateVente && new Date(v.dateVente) <= end)
    }

    return NextResponse.json({
      success: true,
      ventes,
      total: ventes.length,
      nonAttribuees: ventes.filter(v => !v.isAttribue).length,
    })

  } catch (err: any) {
    console.error('[API VENTES GET]', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * POST - Attribuer une vente non attribuée à un produit
 * Body: { venteId: string, produitId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { venteId, produitId } = await req.json()

    if (!venteId || !produitId) {
      return NextResponse.json(
        { success: false, error: 'venteId et produitId requis' },
        { status: 400 }
      )
    }

    // Récupérer la vente
    const venteRef = adminDb.collection('ventes').doc(venteId)
    const venteSnap = await venteRef.get()

    if (!venteSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Vente non trouvée' },
        { status: 404 }
      )
    }

    const venteData = venteSnap.data()!

    // Récupérer le produit
    const produitRef = adminDb.collection('produits').doc(produitId)
    const produitSnap = await produitRef.get()

    if (!produitSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Produit non trouvé' },
        { status: 404 }
      )
    }

    const produitData = produitSnap.data()!

    // Mettre à jour la vente avec les infos du produit
    await venteRef.update({
      produitId: produitId,
      nom: produitData.nom,
      sku: produitData.sku,
      categorie: produitData.categorie,
      marque: produitData.marque || '',
      prixInitial: produitData.prix,
      chineur: produitData.chineur,
      chineurUid: produitData.chineurUid,
      trigramme: produitData.trigramme,
      categorieRapport: produitData.categorieRapport,
      attribue: true,
      source: 'montant_perso_attribue',
      attribueAt: Timestamp.now(),
    })

    // Mettre à jour le produit (décrémenter quantité, marquer vendu si nécessaire)
    const quantiteActuelle = produitData.quantite || 1
    const nouvQuantite = Math.max(0, quantiteActuelle - 1)

    const updateData: any = { quantite: nouvQuantite }
    if (nouvQuantite === 0) {
      updateData.vendu = true
      updateData.dateVente = venteData.dateVente
      updateData.prixVenteReel = venteData.prixVenteReel
    }

    await produitRef.update(updateData)

    return NextResponse.json({
      success: true,
      message: `Vente attribuée à ${produitData.sku}`,
    })

  } catch (err: any) {
    console.error('[API VENTES POST]', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Supprimer une vente
 * Body: { venteId: string, remettreEnStock?: boolean }
 */
export async function DELETE(req: NextRequest) {
  try {
    const { venteId, remettreEnStock } = await req.json()

    if (!venteId) {
      return NextResponse.json(
        { success: false, error: 'venteId requis' },
        { status: 400 }
      )
    }

    const venteRef = adminDb.collection('ventes').doc(venteId)
    const venteSnap = await venteRef.get()

    if (!venteSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Vente non trouvée' },
        { status: 404 }
      )
    }

    const venteData = venteSnap.data()!

    // Si on remet en stock et qu'il y a un produit lié
    if (remettreEnStock && venteData.produitId) {
      const produitRef = adminDb.collection('produits').doc(venteData.produitId)
      const produitSnap = await produitRef.get()
      
      if (produitSnap.exists) {
        const produitData = produitSnap.data()!
        await produitRef.update({
          quantite: (produitData.quantite || 0) + 1,
          vendu: false,
          dateVente: null,
          prixVenteReel: null,
        })
      }
    }

    // Supprimer la vente
    await venteRef.delete()

    return NextResponse.json({
      success: true,
      message: 'Vente supprimée',
    })

  } catch (err: any) {
    console.error('[API VENTES DELETE]', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}