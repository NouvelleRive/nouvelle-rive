// components/VentesPrintemps.tsx
// Page des ventes du corner Printemps : /chineuse/printemps et /admin/printemps.
'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
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
  atelier?: boolean
}

const BROUILLON = 'nr_brouillon_vente_printemps'
const aujourdhui = () => new Date().toISOString().slice(0, 10)

// Photo de téléphone → JPEG 1600 px max, pour rester sous la limite d'upload.
// createImageBitmap refuse certains JPEG (ex. photo transférée par WhatsApp) :
// on retombe alors sur un <img> classique.
async function decoderImage(file: File): Promise<{ img: CanvasImageSource; width: number; height: number }> {
  try {
    const b = await createImageBitmap(file)
    return { img: b, width: b.width, height: b.height }
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return { img, width: img.naturalWidth, height: img.naturalHeight }
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

async function reduireImage(file: File): Promise<Blob> {
  const bitmap = await decoderImage(file)
  const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * ratio)
  canvas.height = Math.round(bitmap.height * ratio)
  canvas.getContext('2d')!.drawImage(bitmap.img, 0, 0, canvas.width, canvas.height)
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
  let jpeg: Blob
  try {
    jpeg = await reduireImage(file)
  } catch {
    throw new Error('format de photo illisible (HEIC ?), utilise un JPEG ou un PNG')
  }
  const form = new FormData()
  form.append('file', new File([jpeg], 'photo.jpg', { type: 'image/jpeg' }))
  form.append('folder', 'printemps/')
  const res = await fetch('/api/upload-bunny', { method: 'POST', body: form })
  if (!res.ok) throw new Error('upload photo échoué')
  return (await res.json()).url
}

function ChampPhoto({ label, file, urlExistante, onChange, onRetirer }: { label: string; file: File | null; urlExistante?: string; onChange: (f: File | null) => void; onRetirer: () => void }) {
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
      {(apercu || urlExistante) && (
        <div className="relative w-24 h-24 mb-2">
          <img src={apercu || urlExistante} alt="" className="w-24 h-24 object-cover rounded border" />
          <button type="button" onClick={onRetirer} aria-label="Retirer la photo"
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border shadow text-gray-600 text-sm leading-none flex items-center justify-center">
            ×
          </button>
        </div>
      )}
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

// emailChineuse : en admin, la chineuse du « Je suis » → sa fiche et ses seules
// ventes sur la facture, comme la facture NR.
export default function VentesPrintemps({ emailChineuse }: { emailChineuse?: string }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [ventes, setVentes] = useState<VentePrintemps[]>([])
  const [chineuse, setChineuse] = useState<ChineuseMeta | null>(null)
  const [relues, setRelues] = useState<Record<string, unknown>>({})
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
  const [atelier, setAtelier] = useState(false)
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
      setDateVente(b.dateVente || aujourdhui()); setCanal(b.canal || ''); setAtelier(b.atelier === true)
      setUrlPiece(b.urlPiece || ''); setUrlTicket(b.urlTicket || '')
      setEnEdition(null); setShowModal(true)
    } catch { /* pas de brouillon */ }
  }, [user])

  useEffect(() => {
    if (!showModal || enEdition) return
    try {
      localStorage.setItem(BROUILLON, JSON.stringify({ description, prix, proprietaire, dateVente, canal, atelier, urlPiece, urlTicket }))
    } catch { /* stockage indisponible */ }
  }, [showModal, enEdition, description, prix, proprietaire, dateVente, canal, atelier, urlPiece, urlTicket])

  function fermerModal() {
    setShowModal(false)
    try { localStorage.removeItem(BROUILLON) } catch { /* rien */ }
  }

  async function envoyer(file: File, setUrl: (u: string) => void) {
    setEnvois(n => n + 1)
    try {
      setUrl(await uploaderPhoto(file))
    } catch (err) {
      setErreur(`Envoi de la photo échoué : ${err instanceof Error ? err.message : 'erreur'}`)
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
    })
    return () => unsub()
  }, [router])

  useEffect(() => {
    if (user) fetchVentes(user)
  }, [user, emailChineuse])

  async function fetchVentes(u: User) {
    setLoading(true)
    try {
      const q = emailChineuse ? `?chineuse=${encodeURIComponent(emailChineuse)}` : ''
      const res = await fetch(`/api/ventes-printemps${q}`, { headers: { Authorization: `Bearer ${await u.getIdToken()}` } })
      const data = await res.json()
      setVentes(data.ventes || [])
      setChineuse(data.chineuse || null)
      setRelues(data.relues || {})
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
    setDescription(''); setPrix(''); setProprietaire(''); setCanal(''); setAtelier(false)
    setPhotoPiece(null); setPhotoTicket(null); setDateVente(aujourdhui()); setErreur('')
    setUrlPiece(''); setUrlTicket('')
    setShowModal(true)
  }

  function modifier(id: string) {
    const v = ventes.find(x => x.id === id)
    if (!v) return
    setEnEdition(v)
    setLectureTicket(''); setLignesTicket([])
    setDescription(v.description); setPrix(String(v.prix).replace('.', ',')); setProprietaire(v.proprietaire); setCanal(v.canal); setAtelier(v.atelier === true)
    setPhotoPiece(null); setPhotoTicket(null); setDateVente(v.dateVente); setErreur('')
    setUrlPiece(v.photoPiece); setUrlTicket(v.photoTicket)
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
    if ((!urlPiece && !photoPiece) || (!urlTicket && !photoTicket)) { setErreur('Les deux photos sont obligatoires'); return }
    setSubmitting(true)
    setErreur('')
    try {
      // Une photo dont l'envoi a échoué en arrière-plan est renvoyée ici.
      const piece = urlPiece || await uploaderPhoto(photoPiece!)
      const ticket = urlTicket || await uploaderPhoto(photoTicket!)
      if (!urlPiece) setUrlPiece(piece)
      if (!urlTicket) setUrlTicket(ticket)
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
          atelier,
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

  const grandePiece = urlPiece
  const grandTicket = urlTicket

  // Relecture par mois : la chineuse valide ses ventes d'un mois (bouton vert).
  const moisVentes = Array.from(new Set(ventes.map(v => `${v.dateVente.slice(5, 7)}-${v.dateVente.slice(0, 4)}`)))
    .sort((a, b) => b.slice(3).localeCompare(a.slice(3)) || b.localeCompare(a))

  async function basculerRelecture(mois: string) {
    if (!user) return
    const relu = !relues[mois]
    setRelues(r => ({ ...r, [mois]: relu || undefined }))
    const q = emailChineuse ? `?chineuse=${encodeURIComponent(emailChineuse)}` : ''
    const res = await fetch(`/api/ventes-printemps${q}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify({ mois, relu }),
    })
    if (!res.ok) { alert('Validation non enregistrée'); fetchVentes(user) }
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
        sousFiltres={chineuse?.codeChineuse ? (
          <div className="flex flex-wrap gap-2">
            {moisVentes.map(mois => {
              const relu = !!relues[mois]
              const [mm, aaaa] = mois.split('-').map(Number)
              const nomMois = format(new Date(aaaa, mm - 1, 1), 'MMMM', { locale: fr })
              return (
                <button key={mois} onClick={() => basculerRelecture(mois)}
                  className={`text-sm px-3 py-1.5 rounded-lg border ${relu
                    ? 'bg-green-500 text-white border-green-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-[#22209C]'}`}>
                  {relu ? `✓ Ventes ${nomMois} relues` : `Valider les ventes ${nomMois}`}
                </button>
              )
            })}
          </div>
        ) : undefined}
        sousTitre={
          <button onClick={ouvrirModal} className="bg-[#22209C] text-white text-sm font-medium px-4 py-2 rounded-lg">
            Nouvelle vente
          </button>
        }
        ventes={ventesListe}
        // Tout le monde voit tout, mais la facture PRI ne porte que ses propres ventes.
        // Sans fiche chineuse (admin en vue NOUVELLE RIVE) : rien à facturer.
        ventesFacture={chineuse ? ventesListe.filter(v => TRIGRAMME_PROPRIETAIRE[v.trigramme] === chineuse.codeChineuse) : []}
        chineuses={PROPRIETAIRES_PRINTEMPS.map(p => ({ trigramme: p, nom: p }))}
        avecFiltreChineuse
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
            <ChampPhoto label="Photo pièce" file={photoPiece} urlExistante={urlPiece} onChange={choisirPiece} onRetirer={() => { setPhotoPiece(null); setUrlPiece('') }} />
            <ChampPhoto label="Photo ticket" file={photoTicket} urlExistante={urlTicket} onChange={choisirTicket} onRetirer={() => { setPhotoTicket(null); setUrlTicket(''); setLignesTicket([]); setLectureTicket('') }} />
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

            {/* Décochée par défaut : les ventes saisies avant cette case n'étaient pas des ateliers */}
            <label className="flex items-center gap-2 text-sm cursor-pointer w-fit">
              <input type="checkbox" checked={atelier} onChange={e => setAtelier(e.target.checked)} className="w-4 h-4 accent-[#22209C]" />
              Atelier
            </label>

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
