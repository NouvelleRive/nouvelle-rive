import { notFound } from 'next/navigation'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import ProduitClient from './ProduitClient'

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  try {
    const db = getFirestore()
    const snap = await db.collection('produits').doc(params.id).get()
    if (!snap.exists) return { title: 'Produit — Nouvelle Rive' }
    const p = snap.data() as any
    const nom = (p.nom || '').replace(/^[A-Z]{2,10}\d{1,4}\s*[-–]\s*/i, '')
    const titre = p.marque ? `${p.marque} — ${nom}` : nom
    const cat = typeof p.categorie === 'object' ? p.categorie?.label : p.categorie || ''
    return {
      title: `${titre} | Nouvelle Rive`,
      description: p.description || `${cat} vintage ${p.marque || ''} ${p.taille || ''} — Nouvelle Rive, Le Marais Paris`.trim(),
      openGraph: {
        images: [p.photos?.face || p.imageUrls?.[0] || ''],
      },
    }
  } catch {
    return { title: 'Produit — Nouvelle Rive' }
  }
}

export default async function ProduitPage({ params }: { params: { id: string } }) {
  const db = getFirestore()
  const snap = await db.collection('produits').doc(params.id).get()

  if (!snap.exists) notFound()

  const data = snap.data() as any
  const produit = { id: snap.id, ...data }

  // Fetch chineuse
  let chineuseInfo = null
  try {
    const tri = (data.trigramme || '').toUpperCase()
    if (tri) {
      const chSnap = await db.collection('chineuse').where('trigramme', '==', tri).limit(1).get()
      if (!chSnap.empty) {
        const ch = chSnap.docs[0].data()
        chineuseInfo = { accroche: ch.accroche, description: ch.description, nom: ch.nom, texteEcoCirculaire: ch.texteEcoCirculaire || 1 }
      }
    }
    if (!chineuseInfo && data.chineurUid) {
      const chSnap = await db.collection('chineuse').where('authUid', '==', data.chineurUid).limit(1).get()
      if (!chSnap.empty) {
        const ch = chSnap.docs[0].data()
        chineuseInfo = { accroche: ch.accroche, description: ch.description, nom: ch.nom, texteEcoCirculaire: ch.texteEcoCirculaire || 1 }
      }
    }
  } catch (e) {
    console.error('Erreur fetch chineuse:', e)
  }

  if (produit.vendu) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
        <p className="uppercase text-xs tracking-widest mb-2" style={{ color: '#999' }}>Vendu</p>
        <p className="text-xs mb-6" style={{ color: '#999' }}>Cette pièce a trouvé preneur</p>
        <a href="/boutique" className="uppercase text-xs tracking-widest hover:opacity-50 transition">← Découvrir d'autres pièces</a>
      </div>
    )
  }

  return <ProduitClient produit={produit} chineuseInfo={chineuseInfo} />
}