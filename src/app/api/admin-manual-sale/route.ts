// app/api/admin-manual-sale/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'

// =====================
// POST - Ajouter une vente manuellement
// =====================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { produitId, prixVenteReel, dateVente } = body

    // Validation
    if (!produitId) {
      return NextResponse.json(
        { success: false, error: 'ID du produit requis' },
        { status: 400 }
      )
    }

    if (typeof prixVenteReel !== 'number' || prixVenteReel <= 0) {
      return NextResponse.json(
        { success: false, error: 'Prix de vente invalide' },
        { status: 400 }
      )
    }

    // Récupérer le produit
    const produitRef = adminDb.collection('produits').doc(produitId)
    const produitSnap = await produitRef.get()

    if (!produitSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Produit non trouvé' },
        { status: 404 }
      )
    }

    const produit = produitSnap.data()

    // Vérifier que le produit n'est pas déjà vendu
    if (produit?.vendu || (produit?.quantite ?? 1) <= 0) {
      return NextResponse.json(
        { success: false, error: 'Ce produit est déjà vendu' },
        { status: 400 }
      )
    }

    // Vérifier que le produit n'est pas supprimé ou retourné
    if (produit?.statut === 'supprime' || produit?.statut === 'retour') {
      return NextResponse.json(
        { success: false, error: 'Ce produit n\'est plus disponible' },
        { status: 400 }
      )
    }

    // Convertir la date
    const dateVenteTimestamp = dateVente 
      ? Timestamp.fromDate(new Date(dateVente))
      : Timestamp.now()

    // Mettre à jour le produit comme vendu
    await produitRef.update({
      vendu: true,
      quantite: 0,
      statut: 'vendu',
      prixVenteReel: prixVenteReel,
      dateVente: dateVenteTimestamp,
      venteManuelle: true,
      updatedAt: FieldValue.serverTimestamp()
    })

    console.log(`✅ Vente manuelle créée pour produit ${produitId}`)

    return NextResponse.json({ 
      success: true,
      message: 'Vente enregistrée avec succès'
    })

  } catch (error: any) {
    console.error('❌ [API ADMIN VENTES POST]', error?.message || error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// =====================
// DELETE - Supprimer une vente
// =====================
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { produitId, remettreEnCaisse } = body

    if (!produitId) {
      return NextResponse.json(
        { success: false, error: 'ID du produit requis' },
        { status: 400 }
      )
    }

    // Récupérer le produit
    const produitRef = adminDb.collection('produits').doc(produitId)
    const produitSnap = await produitRef.get()

    if (!produitSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Produit non trouvé' },
        { status: 404 }
      )
    }

    const produit = produitSnap.data() as any

    // Vérifier que le produit est bien vendu
    if (!produit?.vendu && (produit?.quantite ?? 1) > 0) {
      return NextResponse.json(
        { success: false, error: 'Ce produit n\'est pas marqué comme vendu' },
        { status: 400 }
      )
    }

    if (remettreEnCaisse) {
      // =====================
      // REMETTRE EN CAISSE : reset Firestore + recréer dans Square
      // =====================
      
      // 1. Reset le produit dans Firestore
      await produitRef.update({
        vendu: false,
        quantite: 1,
        statut: null,
        prixVenteReel: FieldValue.delete(),
        dateVente: FieldValue.delete(),
        venteManuelle: FieldValue.delete(),
        // Reset les IDs Square car on va le recréer
        catalogObjectId: FieldValue.delete(),
        variationId: FieldValue.delete(),
        itemId: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      })

      // 2. Recréer dans Square via l'API existante
      const categorie = typeof produit.categorie === 'object' 
        ? produit.categorie?.label 
        : produit.categorie

      // Récupérer le nom de la chineuse depuis son email
      let chineurNom = ''
      if (produit.chineur) {
        const chineuseQuery = await adminDb
          .collection('chineuse')
          .where('email', '==', produit.chineur)
          .limit(1)
          .get()
        
        if (!chineuseQuery.empty) {
          chineurNom = chineuseQuery.docs[0].data()?.nom || ''
        }
      }

      // Récupérer le reportingCategoryId si disponible
      let reportingCategoryId = produit.reportingCategoryId
      if (!reportingCategoryId && categorie) {
        const catQuery = await adminDb
          .collection('categories')
          .where('label', '==', categorie)
          .limit(1)
          .get()
        
        if (!catQuery.empty) {
          reportingCategoryId = catQuery.docs[0].data()?.idsquare
        }
      }

      // Appeler l'API d'import Square
      const importPayload = {
        nom: produit.nom,
        prix: produit.prix,
        description: produit.description || '',
        categorie: categorie,
        reportingCategoryId: reportingCategoryId,
        stock: 1,
        chineurNom: chineurNom,
        chineurEmail: produit.chineur,
        productId: produitId,
        sku: produit.sku,
        marque: produit.marque || '',
        taille: produit.taille || '',
        imageUrl: produit.imageUrl || produit.photos?.face,
        imageUrls: produit.imageUrls || [],
      }

      // Faire l'appel à l'API interne
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : 'http://localhost:3000'
      
      try {
        const importRes = await fetch(`${baseUrl}/api/import-square-produits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(importPayload)
        })

        const importData = await importRes.json()

        if (!importRes.ok) {
          console.error('❌ Erreur import Square:', importData)
          // On ne bloque pas, le produit est quand même remis en stock dans Firestore
        } else {
          console.log(`✅ Produit ${produitId} recréé dans Square:`, importData)
        }
      } catch (squareError: any) {
        console.error('❌ Erreur appel API Square:', squareError?.message)
        // On ne bloque pas
      }

      console.log(`✅ Vente supprimée et produit ${produitId} remis en caisse`)

      return NextResponse.json({ 
        success: true,
        action: 'remis_en_caisse',
        message: 'Vente supprimée et produit remis en caisse'
      })

    } else {
      // =====================
      // SUPPRIMER SANS REMETTRE EN CAISSE : juste annuler la vente
      // =====================
      
      // Marquer comme supprimé (ni vendu, ni disponible)
      await produitRef.update({
        vendu: false,
        statut: 'supprime',
        prixVenteReel: FieldValue.delete(),
        dateVente: FieldValue.delete(),
        venteManuelle: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      })

      console.log(`✅ Vente supprimée pour produit ${produitId} (non remis en caisse)`)

      return NextResponse.json({ 
        success: true,
        action: 'supprime',
        message: 'Vente supprimée'
      })
    }

  } catch (error: any) {
    console.error('❌ [API ADMIN VENTES DELETE]', error?.message || error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}