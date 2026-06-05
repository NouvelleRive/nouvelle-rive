// app/api/admin-family-sale/route.ts
// Vente familiale (personnel) : non encaissée côté Square, mais comptée
// normalement dans le CA / facture chineuse (commission habituelle).
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import { removeFromAllChannels } from '@/lib/syncRemoveFromAllChannels'
import { resolveTrigrammeFromSku } from '@/lib/resolveTrigramme'
import { sendPushToOwner } from '@/lib/webpush'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { produitId, prixVenteReel, dateVente, beneficiaire, vendeuseId, vendeusePrenom } = body

    if (!produitId) {
      return NextResponse.json({ success: false, error: 'ID du produit requis' }, { status: 400 })
    }
    if (typeof prixVenteReel !== 'number' || prixVenteReel < 0) {
      return NextResponse.json({ success: false, error: 'Prix de vente invalide' }, { status: 400 })
    }

    const produitRef = adminDb.collection('produits').doc(produitId)
    const produitSnap = await produitRef.get()
    if (!produitSnap.exists) {
      return NextResponse.json({ success: false, error: 'Produit non trouvé' }, { status: 404 })
    }
    const produit = produitSnap.data() as any

    if (produit?.vendu || (produit?.quantite ?? 1) <= 0) {
      return NextResponse.json({ success: false, error: 'Ce produit est déjà vendu' }, { status: 400 })
    }
    if (produit?.statut === 'supprime' || produit?.statut === 'retour') {
      return NextResponse.json({ success: false, error: 'Ce produit n\'est plus disponible' }, { status: 400 })
    }

    const dateVenteTimestamp = dateVente
      ? Timestamp.fromDate(new Date(dateVente))
      : Timestamp.now()

    // Résoudre chineuse (chineur email, uid, trigramme)
    const trigramme =
      (produit.trigramme || '').toString().toUpperCase() ||
      (await resolveTrigrammeFromSku(adminDb, produit.sku)) ||
      null
    let chineurEmail = produit.chineur || null
    let chineurUid = produit.chineurUid || null
    if (!chineurEmail && trigramme) {
      const chSnap = await adminDb.collection('chineuse')
        .where('trigramme', '==', trigramme)
        .limit(1)
        .get()
      if (!chSnap.empty) {
        chineurEmail = chSnap.docs[0].data().email || null
        chineurUid = chSnap.docs[0].id
      }
    }

    // Marquer le produit comme vendu (famille)
    await produitRef.update({
      vendu: true,
      quantite: 0,
      statut: 'vendu',
      prixVenteReel,
      dateVente: dateVenteTimestamp,
      venteManuelle: true,
      venteFamiliale: true,
      updatedAt: FieldValue.serverTimestamp(),
    })

    // Créer le doc vente (ID déterministe : un produit ne peut être vendu qu'une fois)
    const venteDocId = `familiale_${produitId}`
    const venteData = {
      paymentId: null,
      orderId: null,
      lineItemUid: null,
      dateVente: dateVenteTimestamp,
      prixVenteReel,
      quantite: 1,
      nomSquare: null,
      produitId,
      nom: produit.nom || null,
      sku: produit.sku || null,
      skuSquare: null,
      chineur: chineurEmail,
      chineurUid,
      trigramme,
      prixInitial: produit.prix || null,
      attribue: true,
      source: 'familiale',
      venteFamiliale: true,
      skuSource: 'admin_familiale',
      categorie: produit.categorie || null,
      marque: produit.marque || null,
      beneficiaire: beneficiaire || null,
      vendeuseId: vendeuseId || null,
      vendeusePrenom: vendeusePrenom || null,
      createdAt: dateVenteTimestamp,
    }
    const venteRef = adminDb.collection('ventes').doc(venteDocId)
    const venteSnapBefore = await venteRef.get()
    const isNewVente = !venteSnapBefore.exists
    await venteRef.set(venteData, { merge: true })

    // Notif chineuse : exactement le même format qu'une vente normale (caisse) —
    // pas de mention "familiale" pour qu'elle ne voit aucune différence.
    if (isNewVente && chineurUid) {
      try {
        const photo = produit?.images?.[0] || produit?.imageUrl || produit?.photos?.face || produit?.imageUrls?.[0] || undefined
        await sendPushToOwner(chineurUid, {
          title: '🎉 Vente !',
          body: `${produit.sku || produit.nom} vendu ${prixVenteReel}€`,
          url: '/chineuse/mes-ventes',
          tag: venteDocId,
          image: photo,
        })
      } catch (e) { console.warn('Push notif chineuse failed:', e) }
    }

    // Retrait des canaux externes (le produit n'est plus en stock)
    await removeFromAllChannels({
      id: produitId,
      sku: produit?.sku,
      ebayOfferId: produit?.ebayOfferId,
      ebayListingId: produit?.ebayListingId,
    }).catch(e => console.error('⚠️ Retrait multi-canal (vente familiale) KO:', e?.message))

    console.log(`✅ Vente familiale créée pour produit ${produitId} [${venteDocId}]`)
    return NextResponse.json({ success: true, venteId: venteDocId })
  } catch (error: any) {
    console.error('❌ [API ADMIN FAMILY SALE]', error?.message || error)
    return NextResponse.json(
      { success: false, error: error?.message || 'Erreur serveur' },
      { status: 500 }
    )
  }
}
