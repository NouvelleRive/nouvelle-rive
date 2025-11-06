// app/formulaire/page.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
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
  updateDoc, // ✅ pour MAJ avec catalogObjectId
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebaseConfig'
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import Navbar from '@/components/Navbar'
import * as XLSX from 'xlsx'

type Cat = { label: string; idsquare?: string }

function toDisplayName(opts: { dataNom?: string; displayName?: string | null; email?: string | null }) {
  const { dataNom, displayName, email } = opts
  const fallbackEmail = email ? email.split('@')[0] : 'Chineur·euse'
  return (dataNom || displayName || fallbackEmail).toUpperCase()
}

export default function FormulairePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [chineurNom, setChineurNom] = useState<string>('CHINEUR·EUSE')
  const [categories, setCategories] = useState<Cat[]>([])
  const [categorieRapport, setCategorieRapport] = useState<string>('')
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    categorie: '',
    prix: '',
    codeBarre: '',
    quantite: '',
    photo: null as File | null,
  })

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        router.push('/login')
        return
      }

      setUser(u)

      // 1) Par UID
      let chineuseSnap = await getDoc(doc(db, 'chineuse', u.uid))

      // 2) Fallback par email
      if (!chineuseSnap.exists() && u.email) {
        const byEmail = await getDocs(query(collection(db, 'chineuse'), where('email', '==', u.email)))
        if (!byEmail.empty) {
          chineuseSnap = byEmail.docs[0]
        }
      }

      if (!chineuseSnap.exists()) {
        console.warn('Document chineuse introuvable (UID & email). Utilisation fallback.')
        setChineurNom(toDisplayName({ dataNom: undefined, displayName: u.displayName, email: u.email }))
        setCategories([])
        return
      }

      const data = chineuseSnap.data() as any

      setChineurNom(
        toDisplayName({
          dataNom: data?.nom,
          displayName: u.displayName,
          email: u.email,
        })
      )

      setCategorieRapport(
        data?.['catégorie de rapport'] ||
          data?.['categorie de rapport'] ||
          data?.categorieRapport ||
          ''
      )

      const rawCats =
        data?.['Catégorie'] ||
        data?.['Categories'] ||
        data?.categories ||
        []
      setCategories(Array.isArray(rawCats) ? rawCats : [])
    })

    return () => unsubscribe()
  }, [router])

  const normalizeKey = (key: string) =>
    key.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')

  const alias = {
    nom: ['nom', 'nomdelarticle', 'nomarticle'],
    categorie: ['categorie', 'categories', 'catégorie'],
    prix: ['prix', 'prixttc', 'tarif'],
    description: ['description'],
    codeBarre: ['codebarre', 'gtin'],
    quantite: ['quantite', 'quantitestock', 'nouvellequantitenouvellerive'],
    photo: ['photo', 'image'],
  } as const

  const getAliasKey = (key: string) => {
    const normalized = normalizeKey(key)
    for (const target in alias) {
      if ((alias as any)[target].some((a: string) => normalizeKey(a) === normalized)) {
        return target
      }
    }
    return null
  }

  const parseExcelAndUpload = async () => {
    if (!excelFile || !user) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 })

      let headersIndex = -1
      let mapping: Record<string, number> = {}

      for (let i = 0; i < raw.length; i++) {
        const line = raw[i] as string[]
        const map: Record<string, number> = {}

        line.forEach((cell, index) => {
          const key = getAliasKey(String(cell))
          if (key) map[key] = index
        })

        if (map.nom !== undefined && map.categorie !== undefined && map.prix !== undefined) {
          headersIndex = i
          mapping = map
          break
        }
      }

      if (headersIndex === -1) {
        alert("Impossible de trouver les colonnes 'nom', 'categorie', 'prix' dans le fichier.")
        return
      }

      const rows = (raw as any[]).slice(headersIndex + 1)

      const produitsValidés = rows
        .map((row: any[]) => {
          const produit: any = {}
          for (const key in mapping) produit[key] = row[mapping[key]]
          return produit
        })
        .filter((p: any) => p.nom && p.categorie && p.prix)
        .map((p: any) => ({
          nom: p.nom,
          categorie: p.categorie,
          prix: parseFloat(p.prix),
          description: p.description || '',
          codeBarre: p.codeBarre || '',
          quantite: parseInt(p.quantite) || 1,
          photo: p.photo || '',
        }))

      for (const produit of produitsValidés) {
        await addDoc(collection(db, 'produits'), {
          ...produit,
          chineur: user.email,
          categorieRapport,
          vendu: false,
          createdAt: serverTimestamp(),
        })
      }

      alert(`${produitsValidés.length} produits importés avec succès !`)
    }

    reader.readAsArrayBuffer(excelFile)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return alert('Non connecté·e')

    const { nom, description, categorie, prix, quantite, codeBarre, photo } = formData
    if (!nom || !categorie || !prix || !quantite) {
      return alert('Merci de remplir tous les champs obligatoires')
    }

    try {
      let imageUrl = ''

      if (photo) {
        const storage = getStorage()
        const imageRef = ref(storage, `produits/${user.uid}/${Date.now()}_${photo.name}`)
        await uploadBytes(imageRef, photo)
        imageUrl = await getDownloadURL(imageRef)
      }

      // 1) Créer le doc Firestore
      const docRef = await addDoc(collection(db, 'produits'), {
        nom,
        description,
        categorie, // label côté Firestore
        prix: parseFloat(prix),
        quantite: parseInt(quantite),
        codeBarre,
        chineur: user.email,
        categorieRapport,
        imageUrl,
        vendu: false,
        createdAt: serverTimestamp(),
      })

      // 2) Mapper la catégorie (label -> idsquare)
      const match = categories.find((c) => c?.label === categorie)
      const idsquare = match?.idsquare

      // 3) Envoyer à Square si on a l'ID de catégorie
      if (idsquare) {
        try {
          const res = await fetch('/api/import-square-produits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nom,
              prix: parseFloat(prix),
              description,
              codeBarre,
              categorie: idsquare,      // ✅ Square category ID
              chineurNom: user.uid,     // (ton API s'en sert pour tracer)
              chineurEmail: user.email, // idem
              stock: parseInt(quantite) || 1, // ✅ stock initial
              imageUrl,                 // au cas où ton API le supporte
            }),
          })

          const contentType = res.headers.get('content-type') || ''
          const raw = await res.text()
          if (!contentType.includes('application/json')) {
            console.warn('Réponse non-JSON de /api/import-square-produits:', raw.slice(0, 200))
          }

          let data: any = {}
          try { data = JSON.parse(raw) } catch {}

          if (!res.ok || !data?.success) {
            console.warn('Square non créé:', data?.error || raw)
          } else {
            // 4) MAJ du doc Firestore avec les IDs Square
            const update: Record<string, any> = {}
            if (data.catalogObjectId) update.catalogObjectId = data.catalogObjectId
            if (data.variationId) update.variationId = data.variationId
            if (data.itemId) update.itemId = data.itemId
            if (Object.keys(update).length > 0) {
              await updateDoc(doc(db, 'produits', docRef.id), update)
            }
          }
        } catch (sqErr) {
          console.error('Erreur import Square:', sqErr)
        }
      } else {
        console.warn('Aucun idsquare trouvé pour la catégorie:', categorie)
      }

      alert('Produit ajouté avec succès !')
      setFormData({ nom: '', description: '', categorie: '', prix: '', codeBarre: '', quantite: '', photo: null })
    } catch (err) {
      console.error(err)
      alert("Erreur lors de l'ajout du produit")
    }
  }

  return (
    <>
      <Navbar />
      <main className="max-w-2xl mx-auto p-6">
        <h1 className="text-center text-gray-600 mb-2 uppercase">HELLO {chineurNom} 👋</h1>
        <h2 className="text-3xl font-bold text-center text-primary uppercase mb-6">AJOUTER UN PRODUIT</h2>

        <div ref={dropRef} className="border-2 border-dashed border-primary bg-blue-50 rounded-lg p-6 text-center space-y-3">
          <p className="text-primary font-medium">Importer mes produits en Excel</p>
          <input type="file" accept=".xlsx" onChange={(e) => setExcelFile(e.target.files?.[0] || null)} className="mx-auto" />
          <button
            type="button"
            onClick={parseExcelAndUpload}
            disabled={!excelFile}
            className="mt-2 px-4 py-2 bg-primary text-white rounded hover:opacity-90 disabled:opacity-40"
          >
            Importer le fichier
          </button>
          <a
            href="/template.xlsx"
            download
            className="block mt-2 text-blue-700 underline text-sm"
          >
            📥 Télécharger le modèle Excel
          </a>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-8">
          <div>
            <label className="block font-medium">Nom de la pièce *</label>
            <input type="text" value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} required className="w-full mt-1 border px-3 py-2 rounded-md" />
          </div>

          <div>
            <label className="block font-medium">Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full mt-1 border px-3 py-2 rounded-md" />
          </div>

          <div>
            <label className="block font-medium">Catégorie *</label>
            <select
              value={formData.categorie}
              onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
              required
              className="w-full mt-1 border px-3 py-2 rounded-md h-[45px]"
            >
              <option value="" disabled hidden>Choisir une catégorie</option>
              {categories.length === 0 ? (
                <option disabled value="no-cat">⚠️ Aucune catégorie trouvée</option>
              ) : (
                categories.map((cat, i) => (
                  cat?.label ? (
                    <option key={i} value={cat.label}>{cat.label}</option>
                  ) : (
                    <option key={i} disabled value="">❌ Catégorie invalide</option>
                  )
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block font-medium">Prix (€) *</label>
            <input type="number" value={formData.prix} onChange={(e) => setFormData({ ...formData, prix: e.target.value })} step="0.01" min="0" required className="w-full mt-1 border px-3 py-2 rounded-md" />
          </div>

          <div>
            <label className="block font-medium">Quantité *</label>
            <input type="number" value={formData.quantite} onChange={(e) => setFormData({ ...formData, quantite: e.target.value })} min="1" required className="w-full mt-1 border px-3 py-2 rounded-md" />
          </div>

          <div>
            <label className="block font-medium">Code barre</label>
            <input type="text" value={formData.codeBarre} onChange={(e) => setFormData({ ...formData, codeBarre: e.target.value })} className="w-full mt-1 border px-3 py-2 rounded-md" />
          </div>

          <div>
            <label className="block font-medium">Photo</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFormData({ ...formData, photo: e.target.files?.[0] || null })}
              className="w-full mt-1"
            />
          </div>

          <div>
            <button type="submit" className="bg-primary text-white px-6 py-3 rounded text-lg font-semibold mx-auto block hover:opacity-90">
              Ajouter
            </button>
          </div>
        </form>
      </main>
    </>
  )
}
