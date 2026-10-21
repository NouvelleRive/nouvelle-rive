// app/chineuse/printemps/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User, onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'
import { formatPrix } from '@/lib/formatPrix'
import SalesList, { ChineuseMeta } from '@/components/SalesList'
import { lireTicketPrintemps, LigneTicket } from '@/lib/lireTicketPrintemps'
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

const BROUILLON = 'nr_brouillon_vente_printemps'
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

// OCR dans le navigateur (gratuit) : le ticket préremplit prix, date et canal.
async function lireTicket(file: File) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('fra')
  try {
    const { data } = await worker.recognize(await reduireImage(file))
    return lireTicketPrintemps(data.text)
  } finally {
    await worker.terminate()
  }
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
  const [lectureTicket, setLectureTicket] = useState('')
  const [lignesTicket, setLignesTicket] = useState<LigneTicket[]>([])

  const [description, setDescription] = useState('')
  const [prix, setPrix] = useState('')
  const [proprietaire, setProprietaire] = useState('')
  const [photoPiece, setPhotoPiece] = useState<File | null>(null)
  const [photoTicket, setPhotoTicket] = useState<File | null>(null)
  const [dateVente, setDateVente] = useState(aujourdhui())
  const [canal, setCanal] = useState('')
  // Photos envoyées dès qu'on les choisit : leur URL survit à un rechargement.
  const [urlPiece, setUrlPiece] = useState('')
  const [urlTicket, setUrlTicket] = useState('')
  const [envois, setEnvois] = useState(0)

  // Brouillon : sur téléphone, la page peut se recharger au retour de l'appareil
  // photo (ou pendant la lecture du ticket) et vider le formulaire.
  useEffect(() => {
    if (!user) return
    try {
      const b = JSON.parse(localStorage.getItem(BROUILLON) || 'null')
      if (!b) return
      setDescription(b.description || ''); setPrix(b.prix || ''); setProprietaire(b.proprietaire || '')
      setDateVente(b.dateVente || aujourdhui()); setCanal(b.canal || '')
      setUrlPiece(b.urlPiece || ''); setUrlTicket(b.urlTicket || '')
      setEnEdition(null); setShowModal(true)
    } catch { /* pas de brouillon */ }
  }, [user])

  useEffect(() => {
    if (!showModal || enEdition) return
    try {
      localStorage.setItem(BROUILLON, JSON.stringify({ description, prix, proprietaire, dateVente, canal, urlPiece, urlTicket }))
    } catch { /* stockage indisponible */ }
  }, [showModal, enEdition, description, prix, proprietaire, dateVente, canal, urlPiece, urlTicket])

  function fermerModal() {
    setShowModal(false)
    try { localStorage.removeItem(BROUILLON) } catch { /* rien */ }
  }

  async function envoyer(file: File, setUrl: (u: string) => void) {
    setEnvois(n => n + 1)
    try {
      setUrl(await uploaderPhoto(file))
    } catch {
      setErreur('Envoi de la photo échoué, reprends-la')
    } finally {
      setEnvois(n => n - 1)
    }
  }

  function choisirPiece(file: File | null) {
    setPhotoPiece(file)
    if (file) envoyer(file, setUrlPiece)
  }

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

  async function choisirTicket(file: File | null) {
    setPhotoTicket(file)
    if (!file) return
    envoyer(file, setUrlTicket)
    setLectureTicket('Lecture du ticket…')
    try {
      const lu = await lireTicket(file)
      if (lu.prix) setPrix(String(lu.prix).replace('.', ','))
      if (lu.dateVente) setDateVente(lu.dateVente)
      if (lu.canal) setCanal(lu.canal)
      setLignesTicket(lu.lignes || [])
      setLectureTicket(lu.lignes
        ? `Ticket à ${lu.lignes.length} pièces : clique sur celle que tu saisis`
        : lu.prix || lu.dateVente || lu.canal
          ? 'Ticket lu : vérifie les champs préremplis'
          : 'Ticket illisible : remplis les champs à la main')
    } catch {
      setLectureTicket('Ticket illisible : remplis les champs à la main')
    }
  }

  function ouvrirModal() {
    setLectureTicket(''); setLignesTicket([])
    setEnEdition(null)
    setDescription(''); setPrix(''); setProprietaire(''); setCanal('')
    setPhotoPiece(null); setPhotoTicket(null); setDateVente(aujourdhui()); setErreur('')
    setUrlPiece(''); setUrlTicket('')
    setShowModal(true)
  }

  function modifier(id: string) {
    const v = ventes.find(x => x.id === id)
    if (!v) return
    setEnEdition(v)
    setLectureTicket(''); setLignesTicket([])
    setDescription(v.description); setPrix(String(v.prix).replace('.', ',')); setProprietaire(v.proprietaire); setCanal(v.canal)
    setPhotoPiece(null); setPhotoTicket(null); setDateVente(v.dateVente); setErreur('')
    setUrlPiece(''); setUrlTicket('')
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
    if (envois > 0) { setErreur('Photo en cours d\'envoi, patiente une seconde'); return }
    const piece = urlPiece || enEdition?.photoPiece
    const ticket = urlTicket || enEdition?.photoTicket
    if (!piece || !ticket) { setErreur('Les deux photos sont obligatoires'); return }
    setSubmitting(true)
    setErreur('')
    try {
      const res = await fetch('/api/ventes-printemps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({
          id: enEdition?.id || crypto.randomUUID(),
          description,
          prix: Number(prix.replace(',', '.')),
          proprietaire,
          photoPiece: piece,
          photoTicket: ticket,
          dateVente,
          canal,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'enregistrement échoué')
      fermerModal()
      fetchVentes(user)
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSubmitting(false)
    }
  }

  const grandePiece = urlPiece || enEdition?.photoPiece
  const grandTicket = urlTicket || enEdition?.photoTicket

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
        // Pas de fermeture au clic sur le fond : le double-clic dans la fenêtre
        // de choix de fichier retombait dessus et vidait le formulaire.
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={enregistrer} className={`bg-white rounded-lg w-full ${grandePiece || grandTicket ? 'max-w-5xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto p-5`}>
            <h2 className="text-lg font-bold text-[#22209C] uppercase mb-4">{enEdition ? 'Modifier la vente' : 'Nouvelle vente'}</h2>

            <div className="flex flex-col lg:flex-row gap-5">
            {/* Photos en grand, pour rédiger la description et vérifier le ticket */}
            {(grandePiece || grandTicket) && (
              <div className="lg:w-2/5 grid grid-cols-2 lg:grid-cols-1 gap-3">
                {grandePiece && <a href={grandePiece} target="_blank" rel="noreferrer"><img src={grandePiece} alt="Pièce" className="w-full aspect-square object-cover rounded border" /></a>}
                {grandTicket && <a href={grandTicket} target="_blank" rel="noreferrer"><img src={grandTicket} alt="Ticket" className="w-full aspect-square object-cover rounded border" /></a>}
              </div>
            )}

            <div className="flex-1 space-y-4">
            <ChampPhoto label="Photo pièce" file={photoPiece} urlExistante={urlPiece || enEdition?.photoPiece} onChange={choisirPiece} />
            <ChampPhoto label="Photo ticket" file={photoTicket} urlExistante={urlTicket || enEdition?.photoTicket} onChange={choisirTicket} />
            {lectureTicket && <p className="text-xs text-[#22209C] -mt-2">{lectureTicket}</p>}
            {lignesTicket.length > 0 && (
              <div className="flex flex-wrap gap-2 -mt-2">
                {lignesTicket.map((l, i) => {
                  const choisie = prix === String(l.prix).replace('.', ',') && canal === l.canal
                  return (
                    <button key={i} type="button" onClick={() => { setPrix(String(l.prix).replace('.', ',')); setCanal(l.canal) }}
                      className={`text-xs rounded px-3 py-1.5 border border-[#22209C] ${choisie ? 'bg-[#22209C] text-white' : 'text-[#22209C]'}`}>
                      {formatPrix(l.prix, { decimals: l.prix % 1 ? 2 : 0 })} € · {l.canal.toLowerCase()}
                    </button>
                  )
                })}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input required list="descriptions-printemps" autoComplete="off" value={description} onChange={e => setDescription(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" />
              {/* Suggestions au fil de la frappe : les pièces upcycling reviennent souvent */}
              <datalist id="descriptions-printemps">
                {Array.from(new Set(ventes.map(v => v.description))).map(d => <option key={d} value={d} />)}
              </datalist>
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
              <button type="button" disabled={submitting} onClick={fermerModal} className="flex-1 border rounded px-4 py-2 text-sm">
                Annuler
              </button>
              <button type="submit" disabled={submitting} className="flex-1 bg-[#22209C] text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50">
                {submitting ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
            </div>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
