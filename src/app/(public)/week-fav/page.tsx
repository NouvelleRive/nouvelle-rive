import { redirect } from 'next/navigation'
import { adminDb } from '@/lib/firebaseAdmin'

export const revalidate = 3600

// Lien « week fav » à poser UNE seule fois dans la bio Instagram :
//   nouvellerive.eu/week-fav
// Redirige toujours vers la pièce mise en avant de la semaine (celle publiée
// en feed le mercredi). Résolu côté serveur et caché 1h (revalidate) → coût
// Firestore négligeable, cf. règle « zéro facture Firestore ».
// Redirection temporaire (307) volontaire : la cible change chaque semaine,
// elle ne doit surtout pas être mise en cache définitivement par le navigateur.
export default async function WeekFavRedirect() {
  let target = '/boutique' // filet : aucune pièce en avant → boutique
  try {
    const snap = await adminDb
      .collection('igWeekly')
      .orderBy('weekOf', 'desc')
      .limit(5)
      .get()
    for (const d of snap.docs) {
      const data = d.data() as any
      if (data.status !== 'published' && data.status !== 'chosen') continue
      const chosen = (data.candidates || []).find(
        (c: any) => c.productId === data.chosenProductId
      )
      if (chosen?.boutiqueUrl) {
        // boutiqueUrl est absolu (https://nouvellerive.eu/…) → on passe le path.
        try {
          target = new URL(chosen.boutiqueUrl).pathname
        } catch {
          target = chosen.boutiqueUrl
        }
        break
      }
    }
  } catch (err) {
    console.error('[week-fav] lookup error:', err)
  }
  redirect(target)
}
