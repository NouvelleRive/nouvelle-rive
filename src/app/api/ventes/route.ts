// app/api/ventes/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebaseAdmin'
import { Timestamp } from 'firebase-admin/firestore'
import { removeFromAllChannels } from '@/lib/syncRemoveFromAllChannels'

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

// GET - Récupérer les ventes
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const chineurUid = searchParams.get('chineurUid')
    const chineurEmail = searchParams.get('chineurEmail')
    const trigramme = searchParams.get('trigramme')

    // D'abord déclarer la query par défaut
    let query: FirebaseFirestore.Query = adminDb.collection('ventes')
      .orderBy('dateVente', 'desc')

    // Ensuite filtrer si nécessaire
    if (trigramme) {
      query = adminDb.collection('ventes')
        .where('trigramme', '==', trigramme)
        .orderBy('dateVente', 'desc')
    } else if (chineurEmail) {
      query = adminDb.collection('ventes')
        .where('chineur', '==', chineurEmail)
        .orderBy('dateVente', 'desc')
    } else if (chineurUid) {
      query = adminDb.collection('ventes')
        .where('chineurUid', '==', chineurUid)
        .orderBy('dateVente', 'desc')
    }

    const snapshot = await query.get()

    const ventes = snapshot.docs.map(doc => {
      const d = doc.data()
      return {
        id: doc.id,
        produitId: d.produitId || null,
        nom: d.nom || d.nomSquare || '',
        sku: d.sku || d.skuSquare || null,
        categorie: d.categorie || null,
        marque: d.marque || null,
        trigramme: d.trigramme || null,
        chineurUid: d.chineurUid || null,
        prixInitial: d.prixInitial || null,
        prixVenteReel: d.prixVenteReel || 0,
        dateVente: d.dateVente?.toDate?.()?.toISOString?.() || null,
        remarque: d.remarque || d.noteArticle || null,
        source: d.source || 'manual',
        isAttribue: d.attribue === true || !!d.produitId,
      }
    })

    console.log(`✅ ${ventes.length} ventes chargées${trigramme ? ` pour trigramme ${trigramme}` : chineurEmail ? ` pour ${chineurEmail}` : chineurUid ? ` pour ${chineurUid}` : ''}`)
    return NextResponse.json({ success: true, ventes })
  } catch (err: any) {
    console.error('[API VENTES GET]', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}

// POST - Attribuer une vente à un produit (ADMIN ONLY)
export async function POST(req: NextRequest) {
  try {
    // Vérifier admin
    if (!await isAdmin(req)) {
      return NextResponse.json({ success: false, error: 'Accès admin requis' }, { status: 403 })
    }

    const { venteId, produitId, prixVenteReel } = await req.json()

    if (!venteId || !produitId) {
      return NextResponse.json({ success: false, error: 'venteId et produitId requis' }, { status: 400 })
    }

    // Récupérer le produit
    const produitRef = adminDb.collection('produits').doc(produitId)
    const produitDoc = await produitRef.get()

    if (!produitDoc.exists) {
      return NextResponse.json({ success: false, error: 'Produit non trouvé' }, { status: 404 })
    }

    const p = produitDoc.data()!

    // Mettre à jour la vente
    const venteRef = adminDb.collection('ventes').doc(venteId)
    const venteDoc = await venteRef.get()
    const venteData = venteDoc.data()
    
    const updateVente: any = {
      produitId,
      nom: p.nom || '',
      sku: p.sku || '',
      attribue: true,
    }
    
    // Ajouter seulement les champs définis
    if (p.chineur) updateVente.chineur = p.chineur
    if (p.chineurUid) updateVente.chineurUid = p.chineurUid
    if (p.trigramme) updateVente.trigramme = p.trigramme
    if (p.prix) updateVente.prixInitial = p.prix
    
    // Si nouveau prix fourni, le mettre à jour
    if (prixVenteReel !== undefined) {
      updateVente.prixVenteReel = prixVenteReel
    }
    
    await venteRef.update(updateVente)

    // Mettre à jour le produit (marquer comme vendu)
    const newQty = Math.max(0, (p.quantite || 1) - 1)
    const updateData: any = { quantite: newQty }
    if (newQty === 0) {
      updateData.vendu = true
      updateData.dateVente = venteData?.dateVente || Timestamp.now()
      updateData.prixVenteReel = prixVenteReel || venteData?.prixVenteReel
    }
    await produitRef.update(updateData)

    if (newQty === 0) {
      await removeFromAllChannels({
        id: produitId,
        sku: p.sku,
        ebayOfferId: p.ebayOfferId,
        ebayListingId: p.ebayListingId,
      }).catch(e => console.error('⚠️ Retrait multi-canal (POST) KO:', e?.message))
    }

    console.log(`✅ Vente ${venteId} attribuée au produit ${produitId}`)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[API VENTES POST]', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}

// DELETE - Supprimer une ou plusieurs ventes (ADMIN ONLY)
export async function DELETE(req: NextRequest) {
  try {
    // Vérifier admin
    if (!await isAdmin(req)) {
      return NextResponse.json({ success: false, error: 'Accès admin requis' }, { status: 403 })
    }

    const body = await req.json()
    const { venteId, venteIds, remettreEnStock } = body

    // Suppression batch (plusieurs IDs)
    if (venteIds && Array.isArray(venteIds) && venteIds.length > 0) {
      console.log(`🗑️ Suppression batch de ${venteIds.length} ventes`)
      
      const BATCH_SIZE = 500
      let deleted = 0

      for (let i = 0; i < venteIds.length; i += BATCH_SIZE) {
        const batch = adminDb.batch()
        const batchIds = venteIds.slice(i, i + BATCH_SIZE)
        
        for (const id of batchIds) {
          batch.delete(adminDb.collection('ventes').doc(id))
          deleted++
        }
        
        await batch.commit()
      }

      console.log(`✅ ${deleted} ventes supprimées`)
      return NextResponse.json({ success: true, deleted })
    }

    // Suppression simple (un seul ID)
    if (venteId) {
      const venteRef = adminDb.collection('ventes').doc(venteId)
      const venteDoc = await venteRef.get()
      
      if (!venteDoc.exists) {
        return NextResponse.json({ success: false, error: 'Vente non trouvée' }, { status: 404 })
      }

      const venteData = venteDoc.data()

      // Remettre en stock si demandé
      if (remettreEnStock && venteData?.produitId) {
        const produitRef = adminDb.collection('produits').doc(venteData.produitId)
        const produitDoc = await produitRef.get()
        
        if (produitDoc.exists) {
          const p = produitDoc.data()
          await produitRef.update({
            vendu: false,
            quantite: (p?.quantite || 0) + 1,
            dateVente: null,
            prixVenteReel: null,
          })
        }
      }

      await venteRef.delete()
      console.log(`✅ Vente ${venteId} supprimée`)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'venteId ou venteIds requis' }, { status: 400 })
  } catch (err: any) {
    console.error('[API VENTES DELETE]', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}

// PUT - Attribuer une vente à un produit (ADMIN ONLY)
export async function PUT(req: NextRequest) {
  try {
    // Vérifier admin
    if (!await isAdmin(req)) {
      return NextResponse.json({ success: false, error: 'Accès admin requis' }, { status: 403 })
    }

    const { venteId, produitId, prixVenteReel } = await req.json()

    if (!venteId || !produitId) {
      return NextResponse.json({ success: false, error: 'venteId et produitId requis' }, { status: 400 })
    }

    // Récupérer le produit
    const produitRef = adminDb.collection('produits').doc(produitId)
    const produitDoc = await produitRef.get()

    if (!produitDoc.exists) {
      return NextResponse.json({ success: false, error: 'Produit non trouvé' }, { status: 404 })
    }

    const p = produitDoc.data()!

    // Mettre à jour la vente
    const venteRef = adminDb.collection('ventes').doc(venteId)
    const venteDoc = await venteRef.get()
    const venteData = venteDoc.data()
    
    const updateVente: any = {
      produitId,
      nom: p.nom || '',
      sku: p.sku || '',
      attribue: true,
    }
    
    // Ajouter seulement les champs définis
    if (p.chineur) updateVente.chineur = p.chineur
    if (p.chineurUid) updateVente.chineurUid = p.chineurUid
    if (p.trigramme) updateVente.trigramme = p.trigramme
    if (p.prix) updateVente.prixInitial = p.prix
    
    // Si nouveau prix fourni, le mettre à jour
    if (prixVenteReel !== undefined) {
      updateVente.prixVenteReel = prixVenteReel
    }
    
    await venteRef.update(updateVente)

    // Mettre à jour le produit (marquer comme vendu)
    const newQty = Math.max(0, (p.quantite || 1) - 1)
    const updateData: any = { quantite: newQty }
    if (newQty === 0) {
      updateData.vendu = true
      updateData.dateVente = venteData?.dateVente || Timestamp.now()
      updateData.prixVenteReel = prixVenteReel || venteData?.prixVenteReel
    }
    await produitRef.update(updateData)

    if (newQty === 0) {
      await removeFromAllChannels({
        id: produitId,
        sku: p.sku,
        ebayOfferId: p.ebayOfferId,
        ebayListingId: p.ebayListingId,
      }).catch(e => console.error('⚠️ Retrait multi-canal (PUT) KO:', e?.message))
    }

    console.log(`✅ Vente ${venteId} attribuée au produit ${produitId}`)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[API VENTES PUT]', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}

// PATCH - Modifier le prix d'une vente (ADMIN ONLY)
export async function PATCH(req: NextRequest) {
  try {
    if (!await isAdmin(req)) {
      return NextResponse.json({ success: false, error: 'Accès admin requis' }, { status: 403 })
    }

    const { venteId, prixVenteReel } = await req.json()

    if (!venteId || prixVenteReel === undefined) {
      return NextResponse.json({ success: false, error: 'venteId et prixVenteReel requis' }, { status: 400 })
    }

    const venteRef = adminDb.collection('ventes').doc(venteId)
    await venteRef.update({ prixVenteReel })

    const venteDoc = await venteRef.get()
    const venteData = venteDoc.data()
    
    if (venteData?.produitId) {
      const produitRef = adminDb.collection('produits').doc(venteData.produitId)
      const produitDoc = await produitRef.get()
      if (produitDoc.exists) {
        await produitRef.update({ prixVenteReel })
      }
    }

    console.log(`✅ Prix vente ${venteId} modifié: ${prixVenteReel}€`)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[API VENTES PATCH]', err)
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}