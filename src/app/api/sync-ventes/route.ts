  // src/app/api/sync-ventes/route.ts
  export const runtime = 'nodejs'

  import { NextRequest, NextResponse } from 'next/server'
  import { adminDb, adminAuth } from '@/lib/firebaseAdmin'
  import { syncVentesDepuisSquare } from '@/lib/syncSquareToFirestore'
  import { archiveOrDeleteByVariation } from '@/lib/square/archiveOrDeleteByVariation'
  import { removeFromAllChannels } from '@/lib/syncRemoveFromAllChannels'

  // Helpers
  function isNonEmptyString(x: any): x is string {
    return typeof x === 'string' && x.trim().length > 0
  }

  export async function POST(req: NextRequest) {
    try {
      // --- Auth (Bearer) ---
      const authHeader = req.headers.get('authorization') || ''
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
      let decoded: any = null
      if (token) {
        try {
          decoded = await adminAuth.verifyIdToken(token)
        } catch {
          // on tolère l'absence/échec d’auth si uid est fourni dans le body
        }
      }

      const { uid: uidFromBody, startDateStr, endDateStr } = await req.json().catch(() => ({}))

      const uid: string | null =
        (decoded?.uid as string | undefined) ??
        (isNonEmptyString(uidFromBody) ? uidFromBody : null)

      if (!uid) {
        return NextResponse.json(
          { success: false, error: 'UID manquant (auth Bearer ou body.uid requis)' },
          { status: 400 }
        )
      }

      // --- Récup fiche chineuse (par UID) pour obtenir le nom (attendu par ta lib)
      const chineuseSnap = await adminDb.collection('chineuse').doc(uid).get()
      if (!chineuseSnap.exists) {
        return NextResponse.json(
          { success: false, error: `Chineuse non trouvée pour l'UID : ${uid}` },
          { status: 404 }
        )
      }
      const chineurNom = (chineuseSnap.data() as any)?.nom
      if (!isNonEmptyString(chineurNom)) {
        return NextResponse.json(
          { success: false, error: 'Champ "nom" manquant ou invalide pour cette chineuse' },
          { status: 400 }
        )
      }

      // --- 1) SYNC DES VENTES ---
      const result = await syncVentesDepuisSquare(uid, chineurNom, startDateStr, endDateStr)
      // On s’attend à ce que ta fonction :
      // - crée des docs dans "ventes"
      // - décrémente la quantite du produit correspondant
      // - marque vendu/dateVente/prixVenteReel
      // Si ce n’est pas le cas, on corrige ta lib ensuite.

      // --- 2) CLEANUP: suppression des produits quantite <= 0 (règle NR)
      // on filtre sur les produits appartenant à la chineuse
      const prodQuery = adminDb
        .collection('produits')
        .where('ownerUid', '==', uid) // essaie d'abord ownerUid
      const snap1 = await prodQuery.get()

      // si aucun ownerUid, on tente par email si dispo
      let produitsDocs = snap1.docs
      if (produitsDocs.length === 0 && decoded?.email) {
        const byEmail = await adminDb
          .collection('produits')
          .where('chineur', '==', decoded.email)
          .get()
        produitsDocs = byEmail.docs
      }

      let deletedCount = 0
      let toZeroCount = 0

      for (const d of produitsDocs) {
        const p: any = d.data()
        const qte = typeof p?.quantite === 'number' ? p.quantite : null
        if (qte !== null && qte <= 0) {
          toZeroCount += 1
          const ids = [p?.variationId, p?.catalogObjectId, p?.itemId]
            .filter(Boolean)
            .map((x: any) => String(x))

          // Square : archive/supprime ce qu’on peut
          for (const id of ids) {
            try {
              await archiveOrDeleteByVariation(id)
            } catch {
              // non bloquant
            }
          }

          // eBay : retrait si listé  
          if (p.ebayListingId || p.ebayOfferId) {
            try {
              await removeFromAllChannels({
              id: d.id,
              ebayListingId: p.ebayListingId,
              ebayOfferId: p.ebayOfferId,
              sku: p.sku,
            }, 'square')
            } catch {
              // non bloquant
            }
          }

          // Firestore : suppression définitive du document
          await d.ref.delete()
          deletedCount += 1
        }
      }

      return NextResponse.json({
        success: true,
        message: result?.message ?? 'Sync OK',
        cleanup: { toZeroCount, deletedCount },
      })
    } catch (err: any) {
      console.error('[API SYNC VENTES]', err)
      return NextResponse.json(
        { success: false, error: err?.message || String(err) },
        { status: 500 }
      )
    }
  }
