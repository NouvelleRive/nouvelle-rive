// app/nos-creatrices/page.tsx
// Server Component : données servies depuis le cache blob (getChineusesLiteCached),
// ISR 1h. Plus AUCUNE lecture Firestore par visiteur (avant : 1 scan `chineuse` / visite).
import { getChineusesLiteCached } from '@/lib/getChineusesLiteCached'
import NosCreatricesClient, { type Creatrice } from './NosCreatricesClient'

export const revalidate = 3600

export default async function NosCreateursPage() {
  const all = await getChineusesLiteCached()

  const creatrices: Creatrice[] = all
    .filter(c => c.displayOnWebsite === true)
    .map(c => ({
      id: c.uid,
      nom: c.nom || c.uid,
      specialite: c.specialite || '',
      imageUrl: c.imageUrl || '',
      imagePosition: c.imagePosition || '50% 50%',
      slug: c.slug || c.uid,
      ordre: typeof c.ordre === 'number' ? c.ordre : 999,
    }))
    // Tri alphabétique par nom (insensible aux accents et à la casse)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }))

  return <NosCreatricesClient creatrices={creatrices} />
}
