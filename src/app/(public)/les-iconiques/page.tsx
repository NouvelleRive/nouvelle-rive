import { redirect } from 'next/navigation'
import { adminDb } from '@/lib/firebaseAdmin'

export const dynamic = 'force-dynamic'

export default async function LesIconiquesPage() {
  const snap = await adminDb.collection('iconiques').get()
  const items = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((d) => d.displayOnWebsite !== false && (d.type || 'vintage') === 'vintage')
    .sort((a, b) => (a.ordre || 999) - (b.ordre || 999))

  const first = items[0]
  if (!first) redirect('/')
  redirect(`/les-iconiques/${first.slug || first.id}`)
}
