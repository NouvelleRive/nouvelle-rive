'use client'

import { useEffect, useState, useRef } from 'react'
import { auth, db, storage } from '@/lib/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import jsPDF from 'jspdf'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { SIGNATURE_NR } from '@/lib/signatureNR'
import { useEtapes } from '@/app/deposante/layout'

const CONTRAT_ARTICLES = [
  { n: 1, t: 'Objet et portée', c: "Le présent contrat a pour objet de définir les conditions générales dans lesquelles le Déposant confie au Dépositaire des articles vestimentaires et accessoires de seconde main, afin qu'ils soient mis en vente en boutique et/ou sur la plateforme nouvellerive.eu, pour le compte et au nom du Déposant. Le présent contrat fixe le cadre juridique de la relation entre les parties mais n'a aucune valeur sans bon de dépôt. Seul le bon de dépôt, signé lors de chaque dépôt physique en boutique et listant précisément les articles confiés, leur état et leur prix de vente, fait foi entre les parties et engage le Dépositaire." },
  { n: 2, t: 'Durée', c: "Le contrat est conclu pour une durée de 30 jours à compter de la date de dépôt, renouvelable tacitement pour une nouvelle période de 30 jours. Le Déposant peut récupérer ses articles non vendus à l'issue de chaque période, sur rendez-vous en boutique." },
  { n: 3, t: 'Articles déposés et bon de dépôt', c: "Le dépôt est limité à 5 articles maximum. Le Déposant s'engage à déposer des articles en parfait état (propres, sans taches, sans accrocs, sans odeurs), conformes à la liste de produits acceptés sur nouvellerive.eu. Chaque dépôt physique donne lieu à l'établissement d'un bon de dépôt signé par les deux parties, listant les articles confiés, leur état et leur prix de vente. Ce bon de dépôt constitue le seul document opposable entre les parties pour identifier les articles confiés au Dépositaire — le présent contrat-cadre n'engage le Dépositaire qu'à hauteur des bons de dépôt effectivement signés. Le Déposant certifie être le seul propriétaire des articles déposés et garantit leur authenticité." },
  { n: 4, t: 'Prix, récupération et baisse automatique', c: "Les prix sont fixés d'un commun accord lors du dépôt. À l'issue des 30 premiers jours d'invendu, le Déposant est notifié par email et dispose d'un délai de 7 jours pour récupérer ses Articles sur rendez-vous en boutique. À défaut de récupération dans ce délai, le prix de vente de chaque Article sera automatiquement réduit de 20 % et le contrat poursuivi pour une nouvelle période. Passé 60 jours d'invendu, les Articles seront mis à disposition pour récupération définitive ; à défaut dans les 7 jours suivant notification, ils pourront être donnés à des associations partenaires." },
  { n: 5, t: 'Commission et reversement', c: "60 % reversés au Déposant en cas de règlement en espèces ou par virement — 70 % en cas de règlement en avoir boutique. Le reversement intervient dans les 30 jours suivant la vente. Le Déposant fera son affaire de ses obligations fiscales." },
  { n: 6, t: 'Obligations du Dépositaire', c: "Nouvelle Rive s'engage à assurer la garde et la conservation des Articles, à les exposer en boutique et/ou en ligne, et à verser au Déposant sa quote-part dans les délais convenus. Un récapitulatif des ventes est accessible via l'espace personnel sur nouvellerive.eu." },
  { n: 7, t: 'Assurances — Vol et sinistres', c: "Nouvelle Rive possède un système de sécurité (caméras, alarmes, antivols) et a souscrit une police d'assurance contre les sinistres. En cas de sinistre, Nouvelle Rive reversera au Déposant la quote-part de l'indemnité reçue, sans pouvoir être redevable d'un montant supérieur. Le Déposant reste libre de contracter sa propre assurance." },
  { n: 8, t: 'Obligations du Déposant', c: "Le Déposant s'engage à déposer et récupérer ses Articles à ses frais, en boutique sur rendez-vous. Il garantit l'authenticité des Articles et leur conformité à la législation. En cas de vice caché, la responsabilité lui incombe vis-à-vis de l'acheteur final." },
  { n: 9, t: 'Fin de contrat', c: "Chaque partie peut mettre fin au contrat par email. Les Articles invendus sont restitués dans un délai de 7 jours ouvrés sur rendez-vous, aux frais du Déposant." },
  { n: 10, t: 'Force majeure', c: "Les parties ne seront pas responsables de l'inexécution de leurs obligations en cas de force majeure. Le contrat sera suspendu jusqu'à reprise possible. Faute de reprise dans 30 jours, les parties se rapprocheront pour modifier ou résilier le contrat." },
  { n: 11, t: 'Droit applicable', c: "Le présent contrat est soumis au droit français. En cas de litige, les parties rechercheront une solution amiable avant tout recours judiciaire." },
]

function generateTrigramme(prenom: string, nom: string): string {
  const p = prenom.trim().toUpperCase().replace(/[^A-Z]/g, '')
  const n = nom.trim().toUpperCase().replace(/[^A-Z]/g, '')
  if (!p && !n) return ''
  if (!p) return n.slice(0, 3)
  if (!n) return p.slice(0, 3)
  return p[0] + n.slice(0, 2)
}

async function findUniqueTrigramme(base: string, excludeUid?: string): Promise<string> {
  const snap = await getDocs(query(collection(db, 'deposante'), where('trigramme', '==', base)))
  const taken = snap.docs.filter(d => d.id !== excludeUid)
  if (taken.length === 0) return base
  for (let i = 2; i <= 99; i++) {
    const candidate = base + i
    const s2 = await getDocs(query(collection(db, 'deposante'), where('trigramme', '==', candidate)))
    if (s2.empty) return candidate
  }
  return base
}

export default function ProfilDeposantePage() {
  const { refreshEtapes, setEtape } = useEtapes()
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [uploadingId, setUploadingId] = useState(false)

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [telephone, setTelephone] = useState('')
  const [adresse1, setAdresse1] = useState('')
  const [adresse2, setAdresse2] = useState('')
  const [iban, setIban] = useState('')
  const [bic, setBic] = useState('')
  const [banqueAdresse, setBanqueAdresse] = useState('')
  const [modePaiement, setModePaiement] = useState<'cash' | 'bon' | ''>('')
  const [pieceIdentiteUrl, setPieceIdentiteUrl] = useState('')
  const [trigramme, setTrigramme] = useState('')
  const [currentUid, setCurrentUid] = useState<string>('')
  const [generatingTri, setGeneratingTri] = useState(false)
  const isDrawingRef = useRef(false)
  const [signed, setSigned] = useState(false)
  const [showContratModal, setShowContratModal] = useState(false)
  const [contratSigne, setContratSigne] = useState(false)
  const [contratUrl, setContratUrl] = useState('')
  const [submittingContrat, setSubmittingContrat] = useState(false)
  const [showVerifiedPopup, setShowVerifiedPopup] = useState(false)
  const [dirty, setDirty] = useState(false)
  const router = useRouter()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const font = '"Helvetica Neue", Helvetica, Arial, sans-serif'
  const bleu = '#0000FF'
  const label: React.CSSProperties = {
    fontSize: '11px',
    letterSpacing: '0.2em',
    fontWeight: '600',
    display: 'block',
    marginBottom: '8px',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: '1px solid #000',
    padding: '10px 14px',
    fontSize: '14px',
    fontFamily: font,
    outline: 'none',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.push('/client/login'); return }
      setEmail(u.email || '')
      setCurrentUid(u.uid)

      try {
        // Read direct par doc ID (cohérent avec /api/deposante qui write doc(uid))
        const ref = doc(db, 'deposante', u.uid)
        const snap = await getDoc(ref)
        let d: any = null
        if (snap.exists()) {
          d = snap.data()
        } else {
          // Fallback : ancien doc créé via .add() avec authUid (avant que tout passe par doc(uid))
          const fallback = await getDocs(
            query(collection(db, 'deposante'), where('authUid', '==', u.uid))
          )
          if (!fallback.empty) d = fallback.docs[0].data()
        }
        if (d) {
          setPrenom(d.prenom || '')
          setNom(d.nom || '')
          setTelephone(d.telephone || '')
          setAdresse1(d.adresse1 || '')
          setAdresse2(d.adresse2 || '')
          setIban(d.iban || '')
          setBic(d.bic || '')
          setBanqueAdresse(d.banqueAdresse || '')
          setModePaiement(d.modePaiement || '')
          setPieceIdentiteUrl(d.pieceIdentiteUrl || '')
          setTrigramme(d.trigramme || '')
          setContratSigne(!!d.contratSigne)
          setContratUrl(d.contratUrl || '')
        }
      } catch (e) {
        console.error('Erreur chargement profil deposante', e)
      } finally {
        setLoaded(true)
        // Reset dirty au prochain tick pour laisser les setters d'état se propager
        setTimeout(() => setDirty(false), 0)
      }
    })
    return () => unsub()
  }, [router])

  // =====================
  // CANVAS SIGNATURE
  // =====================
  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    ctx.beginPath(); ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY)
    isDrawingRef.current = true
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'
    ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY); ctx.stroke()
    setSigned(true)
  }

  const stopDraw = () => { isDrawingRef.current = false }

  const startDrawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    ctx.beginPath(); const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      ctx.moveTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY)
    isDrawingRef.current = true
  }

  const drawTouch = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const touch = e.touches[0]
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'
    const scaleX = canvas.width / rect.width
const scaleY = canvas.height / rect.height
ctx.lineTo((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY); ctx.stroke()
    setSigned(true)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    setSigned(false)
  }

  // =====================
  // GÉNÉRATION PDF CONTRAT
  // =====================
  const generateContratPDF = async () => {
    if (!signed) return
    setSubmittingContrat(true)
    try {
      const canvas = canvasRef.current
      const sigDataUrl = canvas ? canvas.toDataURL('image/png') : null
      const doc = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const m = 60
      const today = format(new Date(), 'dd MMMM yyyy', { locale: fr })
      let y = 55

      const txt = (text: string, x: number, yy: number, opts?: { bold?: boolean, size?: number, align?: 'center' | 'left' }) => {
        doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
        doc.setFontSize(opts?.size || 9)
        doc.text(text, x, yy, { align: opts?.align || 'left' })
      }

      txt('CONTRAT DE DÉPÔT-VENTE', pageW / 2, y, { bold: true, size: 14, align: 'center' }); y += 14
      txt('Confidentiel', pageW / 2, y, { size: 8, align: 'center' }); y += 30

      txt('ENTRE LES SOUSSIGNÉS :', m, y, { bold: true }); y += 18
      txt('Le Dépositaire :', m, y, { bold: true }); y += 14
      txt('NR1 SAS — Nouvelle Rive', m, y); y += 12
      txt('5 route du Grand Pont, 78110 Le Vésinet', m, y); y += 12
      txt('SIRET : 94189520300011', m, y); y += 22
      txt('Et le Déposant :', m, y, { bold: true }); y += 14
      txt(`${prenom} ${nom}`.toUpperCase(), m, y); y += 12
      if (adresse1) { txt(adresse1, m, y); y += 12 }
      if (adresse2) { txt(adresse2, m, y); y += 12 }
      txt(`${email}${telephone ? ' — ' + telephone : ''}`, m, y); y += 28

      for (const art of CONTRAT_ARTICLES) {
        if (y > 720) { doc.addPage(); y = 55 }
        txt(`Article ${art.n} — ${art.t}`, m, y, { bold: true }); y += 14
        const lines = doc.splitTextToSize(art.c, pageW - m * 2)
        lines.forEach((line: string) => {
          if (y > 760) { doc.addPage(); y = 55 }
          txt(line, m, y); y += 13
        })
        y += 10
      }

      if (y > 650) { doc.addPage(); y = 55 }
      y += 20
      txt(`Fait à Paris, le ${today}`, m, y); y += 30
      txt('Pour NR1 SAS — Nouvelle Rive', m, y, { bold: true })
      txt(`Pour le·la déposant·e — ${prenom} ${nom}`.toUpperCase(), pageW / 2, y, { bold: true }); y += 14
      y += 40
      doc.addImage('data:image/png;base64,' + SIGNATURE_NR, 'PNG', m, y, 180, 106)
      if (sigDataUrl && signed) {
        doc.addImage(sigDataUrl, 'PNG', pageW / 2, y, 220, 150)
      }

      const pdfBlob = doc.output('blob')

      // Upload direct vers Firebase Storage (contourne la limite body Vercel)
      const uid = auth.currentUser?.uid
      if (!uid) throw new Error('Non authentifiée')
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const path = `contrats-deposante/${uid}_${stamp}.pdf`
      const fileRef = storageRef(storage, path)
      await uploadBytes(fileRef, pdfBlob, { contentType: 'application/pdf' })
      const downloadUrl = await getDownloadURL(fileRef)

      // Maj du doc deposante via API (auth Bearer)
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Non authentifiée')
      const res = await fetch('/api/deposante', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contratSigne: true, contratUrl: downloadUrl, contratPath: path }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Erreur sauvegarde')

      // Maj UI immédiate
      setContratSigne(true)
      setContratUrl(downloadUrl)
      setEtape('contrat', true)
      refreshEtapes()
      setShowContratModal(false)
      setShowVerifiedPopup(true)
      setMsg('✅ Contrat signé')
    } catch (e: any) {
      alert('Erreur sauvegarde contrat — ' + (e?.message || 'réessayez'))
    } finally {
      setSubmittingContrat(false)
    }
  }

  function profileFieldsOk(): string | null {
    if (!prenom.trim()) return 'Prénom manquant'
    if (!nom.trim()) return 'Nom manquant'
    if (!telephone.trim()) return 'Téléphone manquant'
    if (!adresse1.trim()) return 'Adresse manquante'
    if (!iban.trim()) return 'IBAN manquant'
    if (!bic.trim()) return 'BIC manquant'
    if (!pieceIdentiteUrl) return "Pièce d'identité manquante"
    if (!modePaiement) return 'Mode de paiement non choisi'
    return null
  }

  async function openContratModal() {
    const err = profileFieldsOk()
    if (err) { setMsg('❌ ' + err + ' — complétez votre profil avant de signer'); return }
    // Sauvegarde silencieuse du profil avant ouverture
    await save({ silent: true })
    setSigned(false)
    setShowContratModal(true)
  }

  async function handleUploadId(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingId(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch('/api/upload-id', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': file.type,
        },
        body: file,
      })
      const data = await res.json()
      console.log('upload result:', res.status, data)
      if (data.url) { setPieceIdentiteUrl(data.url); setDirty(true) }
    } catch {
      setMsg('❌ Erreur upload')
    } finally {
      setUploadingId(false)
    }
  }

  async function handleGenerateTrigramme() {
    if (!prenom && !nom) return
    setGeneratingTri(true)
    const base = generateTrigramme(prenom, nom)
    const unique = await findUniqueTrigramme(base, currentUid)
    setTrigramme(unique)
    setGeneratingTri(false)
  }

  async function save(opts?: { silent?: boolean }) {
    const silent = !!opts?.silent
    if (!silent) { setSaving(true); setMsg('') }
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) { if (!silent) setMsg('❌ Non connecté'); return }
      if (!trigramme && prenom && nom) {
        const base = generateTrigramme(prenom, nom)
        setTrigramme(base)
      }
      if (!silent && !pieceIdentiteUrl) setMsg('⚠️ N\'oubliez pas d\'ajouter votre pièce d\'identité')

      const res = await fetch('/api/deposante', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prenom, nom, trigramme, telephone, adresse1, adresse2, iban, bic, banqueAdresse, modePaiement, pieceIdentiteUrl }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Erreur')
      setDirty(false)
      if (!silent) setMsg('Enregistré ✅')
    } catch (err: any) {
      if (!silent) setMsg('❌ ' + (err?.message || 'Erreur'))
    } finally {
      if (!silent) setSaving(false)
    }
  }

  if (!loaded) return null

  return (
    <div style={{ fontFamily: font, backgroundColor: '#fff', color: '#000', minHeight: '100vh' }}>
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 24px' }}>

        <p style={{ ...label, color: bleu, marginBottom: '16px' }}>MON ESPACE DÉPOSANTE</p>
        <h1 style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.02em', marginBottom: '8px' }}>Mon profil</h1>

        <div style={{ borderTop: '1px solid #000' }}>

          {/* IDENTITÉ */}
          <div style={{ borderBottom: '1px solid #000', padding: '32px 0' }}>
            <p style={{ ...label, marginBottom: '20px' }}>IDENTITÉ</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={label}>PRÉNOM *</label>
                <input value={prenom} onChange={e => { setPrenom(e.target.value); setDirty(true) }} style={inputStyle} />
              </div>
              <div>
                <label style={label}>NOM *</label>
                <input value={nom} onChange={e => { setNom(e.target.value); setDirty(true) }} style={inputStyle} />
              </div>
            </div>
          </div>

          {/* CONTACT */}
          <div style={{ borderBottom: '1px solid #000', padding: '32px 0' }}>
            <p style={{ ...label, marginBottom: '20px' }}>CONTACT</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={label}>EMAIL</label>
                <input value={email} disabled style={{ ...inputStyle, backgroundColor: '#f5f5f5', color: '#888' }} />
              </div>
              <div>
                <label style={label}>TÉLÉPHONE *</label>
                <input value={telephone} onChange={e => { setTelephone(e.target.value); setDirty(true) }} style={inputStyle} placeholder="+33 6 xx xx xx xx" />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={label}>ADRESSE (LIGNE 1) *</label>
              <input value={adresse1} onChange={e => { setAdresse1(e.target.value); setDirty(true) }} style={inputStyle} />
            </div>
            <div>
              <label style={label}>ADRESSE (LIGNE 2)</label>
              <input value={adresse2} onChange={e => { setAdresse2(e.target.value); setDirty(true) }} style={inputStyle} />
            </div>
          </div>

          {/* PIÈCE D'IDENTITÉ */}
          <div style={{ borderBottom: '1px solid #000', padding: '32px 0' }}>
            <p style={{ ...label, marginBottom: '8px' }}>PIÈCE D'IDENTITÉ *</p>
            {pieceIdentiteUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '80px', height: '52px', border: '1px solid #000', backgroundImage: `url(${pieceIdentiteUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                <div>
                  <p style={{ fontSize: '12px', color: '#444', marginBottom: '6px' }}>Document enregistré ✅</p>
                  <label htmlFor="piece-identite-input" style={{ fontSize: '11px', letterSpacing: '0.15em', fontWeight: '600', textDecoration: 'underline', cursor: 'pointer' }}>
                    Remplacer
                  </label>
                </div>
              </div>
            ) : (
             <label htmlFor="piece-identite-input" style={{ display: 'inline-block', padding: '12px 24px', border: '1px solid #000', backgroundColor: '#fff', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>
              {uploadingId ? 'UPLOAD EN COURS...' : 'AJOUTER UN DOCUMENT →'}
            </label>
                        )}
            <input ref={fileInputRef} id="piece-identite-input" type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleUploadId} />
          </div>

          {/* COORDONNÉES BANCAIRES */}
          <div style={{ borderBottom: '1px solid #000', padding: '32px 0' }}>
            <p style={{ ...label, marginBottom: '20px' }}>COORDONNÉES BANCAIRES</p>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={label}>IBAN *</label>
                <input value={iban} onChange={e => { setIban(e.target.value); setDirty(true) }} style={inputStyle} placeholder="FR76 xxxx xxxx xxxx xxxx xxxx xxx" />
              </div>
              <div>
                <label style={label}>BIC *</label>
                <input value={bic} onChange={e => { setBic(e.target.value); setDirty(true) }} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={label}>ADRESSE DE LA BANQUE</label>
              <input value={banqueAdresse} onChange={e => { setBanqueAdresse(e.target.value); setDirty(true) }} style={inputStyle} />
            </div>
          </div>

          {/* MODE DE PAIEMENT */}
          <div style={{ borderBottom: '1px solid #000', padding: '32px 0' }}>
            <p style={{ ...label, marginBottom: '20px' }}>MODE DE PAIEMENT PRÉFÉRÉ</p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {(['cash', 'bon'] as const).map((mode) => {
                const selected = modePaiement === mode
                return (
                  <button
                    key={mode}
                    onClick={() => { setModePaiement(mode); setDirty(true) }}
                    style={{
                      padding: '14px 24px',
                      border: '1px solid #000',
                      backgroundColor: selected ? '#000' : '#fff',
                      color: selected ? '#fff' : '#000',
                      cursor: 'pointer',
                      textAlign: 'left',
                      lineHeight: 1.4,
                    }}
                  >
                    <div style={{ fontSize: '12px', letterSpacing: '0.2em', fontWeight: 600 }}>
                      {mode === 'cash' ? 'VIREMENT' : "BON D'ACHAT"}
                    </div>
                    <div style={{ fontSize: '11px', opacity: 0.75, marginTop: 4 }}>
                      {mode === 'cash' ? '40% de commission' : '30% de commission'}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* CONTRAT — statut */}
          {contratSigne && (
            <div style={{ borderBottom: '1px solid #000', padding: '32px 0' }}>
              <p style={{ ...label, marginBottom: '8px' }}>CONTRAT DE DÉPÔT-VENTE</p>
              <p style={{ fontSize: '14px', color: '#000', marginBottom: '16px' }}>✅ Votre contrat est signé et enregistré.</p>
              <div style={{ backgroundColor: '#f5f5ff', border: `1px solid ${bleu}`, padding: '16px 20px', marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                  Vos informations vont être vérifiées par notre équipe. Si des éléments sont erronés ou manquants, nous ne pourrons pas prendre votre dépôt.
                </p>
              </div>
              {contratUrl && (
                <a href={contratUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600', textDecoration: 'underline', color: bleu }}>
                  VOIR LE CONTRAT (PDF) →
                </a>
              )}
            </div>
          )}

          {/* ACTIONS BAS DE PAGE */}
          <div style={{ paddingTop: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {!contratSigne ? (
              <>
                <button
                  onClick={() => save()}
                  disabled={saving || !dirty}
                  style={{ padding: '16px 32px', backgroundColor: bleu, color: '#fff', border: 'none', cursor: (saving || !dirty) ? 'not-allowed' : 'pointer', fontSize: '12px', letterSpacing: '0.2em', fontWeight: '600', opacity: !dirty ? 0.4 : 1 }}
                >
                  {saving ? 'ENREGISTREMENT...' : 'ENREGISTRER'}
                </button>
                <button
                  onClick={openContratModal}
                  disabled={saving}
                  style={{ padding: '16px 32px', backgroundColor: bleu, color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '12px', letterSpacing: '0.2em', fontWeight: '600' }}
                >
                  LIRE ET SIGNER LE CONTRAT →
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={async () => { if (dirty) await save({ silent: true }); router.push('/deposante/formulaire') }}
                  disabled={saving}
                  style={{ padding: '16px 32px', backgroundColor: bleu, color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '12px', letterSpacing: '0.2em', fontWeight: '600' }}
                >
                  CRÉER MES PIÈCES →
                </button>
                <button
                  onClick={() => save()}
                  disabled={saving || !dirty}
                  style={{ padding: '12px 24px', backgroundColor: 'transparent', color: '#000', border: '1px solid #000', cursor: (saving || !dirty) ? 'not-allowed' : 'pointer', fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600', alignSelf: 'flex-start', opacity: !dirty ? 0.4 : 1 }}
                >
                  {saving ? 'ENREGISTREMENT...' : 'METTRE À JOUR MES INFOS'}
                </button>
              </>
            )}
            {msg && <span style={{ fontSize: '13px', color: msg.includes('❌') ? 'red' : 'green' }}>{msg}</span>}
          </div>

        </div>
      </div>

      {/* MODALE CONTRAT */}
      {showContratModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 60, display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: '24px' }}>
          <div style={{ backgroundColor: '#fff', maxWidth: '900px', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header modale */}
            <div style={{ padding: '20px 28px', borderBottom: '1px solid #000', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '14px', letterSpacing: '0.2em', fontWeight: '700', margin: 0 }}>CONTRAT DE DÉPÔT-VENTE</h2>
              <button onClick={() => setShowContratModal(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }} aria-label="Fermer">×</button>
            </div>

            {/* Corps scrollable */}
            <div style={{ overflowY: 'auto', padding: '24px 28px', flex: 1, fontSize: '13px', lineHeight: 1.6 }}>
              <p style={{ fontWeight: 700, marginBottom: 8 }}>ENTRE LES SOUSSIGNÉS :</p>
              <p style={{ marginBottom: 4 }}><strong>Le Dépositaire :</strong> NR1 SAS — Nouvelle Rive, 5 route du Grand Pont, 78110 Le Vésinet — SIRET 941 895 203 00011</p>
              <p style={{ marginBottom: 16 }}><strong>Et le Déposant :</strong> {prenom} {nom}{adresse1 ? ` — ${adresse1}` : ''}{adresse2 ? ` ${adresse2}` : ''}{telephone ? ` — ${telephone}` : ''} — {email}</p>

              {CONTRAT_ARTICLES.map(art => (
                <div key={art.n} style={{ marginBottom: 14 }}>
                  <p style={{ fontWeight: 700, marginBottom: 4 }}>Article {art.n} — {art.t}</p>
                  <p>{art.c}</p>
                </div>
              ))}

              <div style={{ marginTop: 28, padding: '20px 0', borderTop: '1px solid #ddd' }}>
                <p style={{ ...label, marginBottom: 8 }}>VOTRE SIGNATURE</p>
                <p style={{ fontSize: 11, color: '#666', marginBottom: 12 }}>Signez avec la pointe du doigt ou la souris dans le cadre ci-dessous, puis cliquez sur "Télécharger" pour enregistrer.</p>
                <canvas
                  ref={canvasRef}
                  width={1600}
                  height={500}
                  style={{ width: '100%', height: '60vh', maxHeight: '500px', minHeight: '320px', border: '1px solid #000', cursor: 'crosshair', backgroundColor: '#fafafa', display: 'block', touchAction: 'none' }}
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={stopDraw}
                  onMouseLeave={stopDraw}
                  onTouchStart={startDrawTouch}
                  onTouchMove={drawTouch}
                  onTouchEnd={stopDraw}
                />
                <button onClick={clearCanvas} style={{ marginTop: 8, fontSize: 11, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>Effacer la signature</button>
              </div>
            </div>

            {/* Footer modale */}
            <div style={{ padding: '20px 28px', borderTop: '1px solid #000', display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
              <button
                onClick={() => setShowContratModal(false)}
                disabled={submittingContrat}
                style={{ padding: '12px 20px', backgroundColor: '#fff', color: '#000', border: '1px solid #000', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
              >
                ANNULER
              </button>
              <button
                onClick={generateContratPDF}
                disabled={!signed || submittingContrat}
                style={{ padding: '12px 32px', backgroundColor: !signed || submittingContrat ? '#888' : '#000', color: '#fff', border: 'none', cursor: !signed || submittingContrat ? 'not-allowed' : 'pointer', fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
              >
                {submittingContrat ? 'SIGNATURE EN COURS...' : 'SIGNER'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP VÉRIFICATION POST-SIGNATURE */}
      {showVerifiedPopup && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: '#fff', maxWidth: 400, width: '100%', padding: 32, fontFamily: font }}>
            <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Vos informations vont être vérifiées par notre équipe. Si des éléments sont erronés ou manquants, nous ne pourrons pas prendre votre dépôt.
            </p>
            <button
              onClick={() => { setShowVerifiedPopup(false); router.push('/deposante/formulaire') }}
              style={{ width: '100%', padding: '14px 24px', backgroundColor: bleu, color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', letterSpacing: '0.2em', fontWeight: '600' }}
            >
              CRÉER LES PIÈCES →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}