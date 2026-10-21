// app/chineuse/printemps/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import SalesList, { ChineuseMeta } from '@/components/SalesList'
import { EMAILS_PRINTEMPS, PROPRIETAIRES_PRINTEMPS, CANAUX_PRINTEMPS, TRIGRAMME_PROPRIETAIRE } from '@/lib/ventesPrintemps'

type VentePrintemps = {
  id: string
  description: string
  prix: number
  proprietaire: string
  photoPiece: string
  photoTicket: string
  dateVente: string
  canal: string
}

const aujourdhui = () => new Date().toISOString().slice(0, 10)

// Photo de téléphone → JPEG 1600 px max, pour rester sous la limite d'upload.
async function reduireImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * ratio)
  canvas.height = Math.round(bitmap.height * ratio)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('image illisible'))), 'image/jpeg', 0.85)
  )
}

async function uploaderPhoto(file: File): Promise<string> {
  const form = new FormData()
  form.append('file', new File([await reduireImage(file)], 'photo.jpg', { type: 'image/jpeg' }))
  form.append('folder', 'printemps/')
  const res = await fetch('/api/upload-bunny', { method: 'POST', body: form })
  if (!res.ok) throw new Error('upload photo échoué')
  return (await res.json()).url
}

function ChampPhoto({ label, file, urlExistante, onChange }: { label: string; file: File | null; urlExistante?: string; onChange: (f: File | null) => void }) {
  const [apercu, setApercu] = useState<string | null>(null)
  useEffect(() => {
    if (!file) { setApercu(null); return }
    const url = URL.createObjectURL(file)
    setApercu(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {(apercu || urlExistante) && <img src={apercu || urlExistante} alt="" className="w-24 h-24 object-cover rounded mb-2 border" />}
      <div className="flex gap-2">
        <label className="flex-1 text-center text-sm border border-[#22209C] text-[#22209C] rounded px-3 py-2 cursor-pointer">
          Image déjà prise
          <input type="file" accept="image/*" className="hidden" onChange={e => onChange(e.target.files?.[0] || null)} />
        </label>
        <label className="flex-1 text-center text-sm border border-[#22209C] text-[#22209C] rounded px-3 py-2 cursor-pointer">
          Nouvelle photo
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => onChange(e.target.files?.[0] || null)} />
        </label>
      </div>
    </div>
  )
}

export default function VentesPrintempsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [ventes, setVentes] = useState<VentePrintemps[]>([])
  const [chineuse, setChineuse] = useState<ChineuseMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [erreur, setErreur] = useState('')
  const [enEdition, setEnEdition] = useState<VentePrintemps | null>(null)

  const [description, setDescription] = useState('')
  const [prix, setPrix] = useState('')
  const [proprietaire, setProprietaire] = useState('')
  const [photoPiece, setPhotoPiece] = useState<File | null>(null)
  const [photoTicket, setPhotoTicket] = useState<File | null>(null)
  const [dateVente, setDateVente] = useState(aujourdhui())
  const [canal, setCanal] = useState('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { router.push('/login'); return }
      if (!EMAILS_PRINTEMPS.includes(u.email || '')) { router.push('/chineuse/performance'); return }
      setUser(u)
      fetchVentes(u)
    })
    return () => unsub()
  }, [router])

  async function fetchVentes(u: User) {
    setLoading(true)
    try {
      const res = await fetch('/api/ventes-printemps', { headers: { Authorization: `Bearer ${await u.getIdToken()}` } })
      const data = await res.json()
      setVentes(data.ventes || [])
      setChineuse(data.chineuse || null)
    } catch (err) {
      console.error('Erreur chargement ventes Printemps:', err)
    } finally {
      setLoading(false)
    }
  }

  function ouvrirModal() {
    setEnEdition(null)
    setDescription(''); setPrix(''); setProprietaire(''); setCanal('')
    setPhotoPiece(null); setPhotoTicket(null); setDateVente(aujourdhui()); setErreur('')
    setShowModal(true)
  }

  function modifier(id: string) {
    const v = ventes.find(x => x.id === id)
    if (!v) return
    setEnEdition(v)
    setDescription(v.description); setPrix(String(v.prix).replace('.', ',')); setProprietaire(v.proprietaire); setCanal(v.canal)
    setPhotoPiece(null); setPhotoTicket(null); setDateVente(v.dateVente); setErreur('')
    setShowModal(true)
  }

  async function supprimer(id: string) {
    if (!user) return
    const v = ventes.find(x => x.id === id)
    if (!confirm(`Supprimer la vente « ${v?.description || ''} » ?`)) return
    const res = await fetch(`/api/ventes-printemps?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
    })
    if (!res.ok) { alert('Suppression échouée'); return }
    fetchVentes(user)
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if ((!photoPiece && !enEdition) || (!photoTicket && !enEdition)) { setErreur('Les deux photos sont obligatoires'); return }
    setSubmitting(true)
    setErreur('')
    try {
      const [urlPiece, urlTicket] = await Promise.all([
        photoPiece ? uploaderPhoto(photoPiece) : enEdition!.photoPiece,
        photoTicket ? uploaderPhoto(photoTicket) : enEdition!.photoTicket,
      ])
      const res = await fetch('/api/ventes-printemps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({
          id: enEdition?.id || crypto.randomUUID(),
          description,
          prix: Number(prix.replace(',', '.')),
          proprietaire,
          photoPiece: urlPiece,
          photoTicket: urlTicket,
          dateVente,
          canal,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'enregistrement échoué')
      setShowModal(false)
      fetchVentes(user)
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  const ventesListe = ventes.map(v => ({
    id: v.id,
    nom: v.description,
    trigramme: v.proprietaire,
    categorie: v.canal,
    prix: v.prix,
    dateVente: v.dateVente,
    imageUrls: [v.photoPiece, v.photoTicket],
  }))

  return (
    <>
      <SalesList
        titre="VENTES PRINTEMPS"
        sousTitre={
          <button onClick={ouvrirModal} className="bg-[#22209C] text-white text-sm font-medium px-4 py-2 rounded-lg">
            Nouvelle vente
          </button>
        }
        ventes={ventesListe}
        // Tout le monde voit tout, mais la facture PRI ne porte que ses propres ventes.
        ventesFacture={chineuse ? ventesListe.filter(v => TRIGRAMME_PROPRIETAIRE[v.trigramme] === chineuse.codeChineuse) : undefined}
        chineuse={chineuse}
        userEmail={user?.email || undefined}
        prefixeFacture="PRI"
        loading={loading}
        onModifierPrix={v => modifier(v.id)}
        onSupprimer={v => supprimer(v.id)}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !submitting && setShowModal(false)}>
          <form onSubmit={enregistrer} onClick={e => e.stopPropagation()} className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-4">
            <h2 className="text-lg font-bold text-[#22209C] uppercase">{enEdition ? 'Modifier la vente' : 'Nouvelle vente'}</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input required value={description} onChange={e => setDescription(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prix (€)</label>
              <input required inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" value={prix} onChange={e => setPrix(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Propriétaire</label>
              <select required value={proprietaire} onChange={e => setProprietaire(e.target.value)} className="w-full border rounded px-3 py-2 text-sm bg-white">
                <option value="" disabled>Choisir…</option>
                {PROPRIETAIRES_PRINTEMPS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <ChampPhoto label="Photo pièce" file={photoPiece} urlExistante={enEdition?.photoPiece} onChange={setPhotoPiece} />
            <ChampPhoto label="Photo ticket" file={photoTicket} urlExistante={enEdition?.photoTicket} onChange={setPhotoTicket} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de vente</label>
              <input required type="date" value={dateVente} onChange={e => setDateVente(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendu sur</label>
              <select required value={canal} onChange={e => setCanal(e.target.value)} className="w-full border rounded px-3 py-2 text-sm bg-white">
                <option value="" disabled>Choisir…</option>
                {CANAUX_PRINTEMPS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {erreur && <p className="text-sm text-red-600">{erreur}</p>}

            <div className="flex gap-2 pt-2">
              <button type="button" disabled={submitting} onClick={() => setShowModal(false)} className="flex-1 border rounded px-4 py-2 text-sm">
                Annuler
              </button>
              <button type="submit" disabled={submitting} className="flex-1 bg-[#22209C] text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50">
                {submitting ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
