import { redirect } from 'next/navigation'

// Lien « week fav » à poser dans la bio Instagram : nouvellerive.eu/week-fav
// → renvoie vers la sélection « Nos pièces préférées » (/coups-de-coeur), pilotée
// par l'équipe (champ favoriEquipe, amendable dans /admin/site → Week fav).
// Redirection temporaire (307) : si la destination change un jour, pas de cache
// navigateur définitif.
export default function WeekFavRedirect() {
  redirect('/coups-de-coeur')
}
