import { getWeekFavGroupedServer } from '@/lib/produitsServer'
import WeekFavClient from './WeekFavClient'

export const revalidate = 3600

// Page publique « Week fav » (lien bio Instagram : nouvellerive.eu/week-fav).
// Contenu = la sélection de l'équipe (favoriEquipe), pilotée depuis
// /admin/site → « Week fav ». Groupé par semaine : la semaine en cours + les
// précédentes. ISR 1h + purge à l'ajout/retrait admin.
export default async function WeekFavPage() {
  const groups = await getWeekFavGroupedServer(200)
  return <WeekFavClient groups={groups} />
}
