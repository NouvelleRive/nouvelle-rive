'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebaseConfig'
import ProductForm, { ProductFormData, Cat } from '@/components/ProductForm'
import { checkSkuUnique } from '@/lib/admin/helpers'
import { MARQUES_DEPOSANTE, getPrixRange } from '@/lib/marquesDeposante'

// Catégories extraites du lib
const CATEGORIES_DEPOSANTE: Cat[] = Array.from(
  new Set(
    MARQUES_DEPOSANTE.flatMap(m => (m.prix || []).map(p => p.categorie))
  )
).map(label => ({ label }))

// =====================
// HELPERS (identiques chineuse)
// =====================
function toDisplayName(opts: { dataNom?: string; displayName?: string | null; email?: string | null }) {
  const { dataNom, displayName, email } = opts
  const fallbackEmail = email ? email.split('@')[0] : 'Déposant·e'
  return (dataNom || displayName || fallbackEmail).toUpperCase()
}

function extractSkuNumFromSkuOrName(value: string, tri: string) {
  const v = value?.toString()?.trim() || ''
  const m1 = v.match(new RegExp(`^${tri}(\\d+)$`, 'i'))
  if (m1) return parseInt(m1[1], 10)
  const m2 = v.match(new RegExp(`^${tri}(\\d+)\\s*-`, 'i'))
  if (m2) return parseInt(m2[1], 10)
  return null
}

async function computeNextSkuForTrigram(trigramme: string, userEmail: string): Promise<string> {
  const tri = (trigramme || '').toUpperCase().trim()
  if (!tri || !userEmail) return ''
  const qSnap = await getDocs(
    query(collection(db, 'produits'), where('trigramme', '==', tri))
  )
  let maxNum = 0
  qSnap.forEach((d) => {
    const data: any = d.data()
    const trySku = extractSkuNumFromSkuOrName(data?.sku || '', tri)
    const tryName = extractSkuNumFromSkuOrName(data?.nom || '', tri)
    const n = Math.max(trySku ?? 0, tryName ?? 0)
    if (n > maxNum) maxNum = n
  })
  return `${tri}${maxNum + 1}`
}

// =====================
// COMPONENT
// =====================
export default function DeposanteFormulairePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [deposanteNom, setDeposanteNom] = useState<string>('DÉPOSANT·E')
  const [trigramme, setTrigramme] = useState<string>('')
  const [sku, setSku] = useState<string>('')
  const [loading, setLoading] = useState(false)

  async function refreshSku(tri: string, userEmail: string) {
    if (!tri?.trim() || !userEmail) { setSku(''); return }
    try {
      const next = await computeNextSkuForTrigram(tri, userEmail)
      setSku(next)
    } catch { setSku('') }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/client/login'); return }
      setUser(u)

      const snap = await getDoc(doc(db, 'deposante', u.uid))
      if (!snap.exists()) {
        setDeposanteNom(toDisplayName({ displayName: u.displayName, email: u.email }))
        return
      }

      const data = snap.data() as any
      setDeposanteNom(toDisplayName({ dataNom: data?.prenom ? `${data.prenom} ${data.nom || ''}`.trim() : undefined, displayName: u.displayName, email: u.email }))

      const tri = (data?.trigramme || '').toString().trim().toUpperCase()
      setTrigramme(tri)
      if (u.email) await refreshSku(tri, u.email)
    })
    return () => unsubscribe()
  }, [router])

  const handleSubmit = async (formData: ProductFormData) => {
    if (!user || !trigramme) return
    setLoading(true)
    try {
      const isUnique = await checkSkuUnique(sku)
      if (!isUnique) {
        alert(`❌ Le SKU "${sku}" est déjà utilisé.`)
        setLoading(false)
        return
      }

      const range = getPrixRange(formData.marque, formData.categorie)
      if (range) {
        const prix = parseFloat(formData.prix)
        if (prix < range.min || prix > range.max) {
          alert(`⚠️ Prix hors marché pour cette pièce.\nFourchette conseillée : ${range.min}€ – ${range.max}€\n\nAjuste le prix ou contacte-nous.`)
          setLoading(false)
          return
        }
      }

      const fullName = `${sku} - ${formData.nom.trim()}`

      let imageUrls: string[] = []
      if (formData.photoOrder && formData.photoOrder.length > 0) {
        imageUrls = formData.photoOrder.map(item => item.url).filter(Boolean) as string[]
      } else {
        if (formData.existingPhotos.face) imageUrls.push(formData.existingPhotos.face)
        if (formData.existingPhotos.dos) imageUrls.push(formData.existingPhotos.dos)
        if (formData.existingPhotos.details) imageUrls.push(...formData.existingPhotos.details)
      }

      const photosReady = Boolean(formData.existingPhotos.face)
      const photosData: Record<string, any> = {}
      if (formData.existingPhotos.face) photosData.face = formData.existingPhotos.face
      if (formData.existingPhotos.dos) photosData.dos = formData.existingPhotos.dos
      if (formData.existingPhotos.details?.length) photosData.details = formData.existingPhotos.details

      await addDoc(collection(db, 'produits'), {
        nom: fullName,
        description: formData.description || '',
        categorie: formData.categorie,
        prix: parseFloat(formData.prix),
        quantite: parseInt(formData.quantite) || 1,
        marque: formData.marque.trim(),
        taille: formData.taille.trim(),
        material: formData.material?.trim() || null,
        color: formData.color?.trim() || null,
        madeIn: formData.madeIn || null,
        modele: formData.modele?.trim() || null,
        motif: formData.motif?.trim() || null,
        sleeveLength: formData.sleeveLength?.trim() || null,
        collarType: formData.collarType?.trim() || null,
        garmentLength: formData.garmentLength?.trim() || null,
        closureType: formData.closureType?.trim() || null,
        shoeType: formData.shoeType?.trim() || null,
        sku,
        chineur: user.email,
        chineurUid: user.uid,
        trigramme,
        source: 'deposante',
        photos: photosData,
        imageUrls,
        imageUrl: imageUrls[0] || '',
        photosReady,
        vendu: false,
        recu: false,
        createdAt: serverTimestamp(),
      })

      alert('✅ Pièce ajoutée avec succès !')
      if (user.email) await refreshSku(trigramme, user.email)
    } catch (err: any) {
      alert('Erreur : FI')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-4">
      <div className="mb-4">
        <p className="text-sm text-gray-500">Hello {deposanteNom} 👋</p>
        <h1 className="text-xl font-bold text-[#22209C]">DÉPOSER UNE PIÈCE</h1>
      </div>

      <ProductForm
        key={sku}
        mode="create"
        isAdmin={false}
        categories={CATEGORIES_DEPOSANTE}
        sku={sku}
        userName={deposanteNom}
        trigramme={trigramme}
        onSubmit={handleSubmit}
        loading={loading}
        showExcelImport={false}
      />

      {!trigramme?.trim() && (
        <p className="text-xs text-red-600 text-center mt-4">
          ⚠️ Trigramme absent — complétez votre <a href="/deposante/profil" className="underline">profil</a> d'abord.
        </p>
      )}

      {/* TODO: restreindre le champ marque à NOMS_MARQUES_DEPOSANTE dans ProductForm */}
    </main>
  )
}