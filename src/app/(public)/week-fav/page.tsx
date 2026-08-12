import { getWeekFavServer } from '@/lib/produitsServer'
import WeekFavClient from './WeekFavClient'

export const revalidate = 3600

// Page publique « Week fav » (lien bio Instagram : nouvellerive.eu/week-fav).
// Contenu = la sélection de l'équipe (favoriEquipe), pilotée depuis
// /admin/site → « Week fav ». ISR 1h + purge à l'ajout/retrait admin.
export default async function WeekFavPage() {
  const initialProduits = await getWeekFavServer(50)
  return <WeekFavClient initialProduits={initialProduits} />
}
