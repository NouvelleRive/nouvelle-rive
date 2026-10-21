// app/admin/printemps/page.tsx
// Même page que /chineuse/printemps, dans le layout admin (bandeau « Je suis »).
// La chineuse choisie fournit sa fiche et le filtre de la facture PRI.
'use client'

import VentesPrintemps from '@/components/VentesPrintemps'
import { useAdmin } from '@/lib/admin/context'

export default function Page() {
  const { selectedChineuse } = useAdmin()
  return <VentesPrintemps emailChineuse={selectedChineuse?.email} />
}
