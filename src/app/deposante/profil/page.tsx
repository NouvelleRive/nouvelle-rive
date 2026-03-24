'use client'

import { useEffect, useState, useRef } from 'react'
import { auth, db } from '@/lib/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'
import jsPDF from 'jspdf'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { SIGNATURE_NR } from '@/lib/signatureNR'

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
        const snap = await getDocs(
          query(collection(db, 'deposante'), where('authUid', '==', u.uid))
        )
        if (!snap.empty) {
          const d = snap.docs[0].data()
          setPrenom(d?.prenom || '')
          setNom(d?.nom || '')
          setTelephone(d?.telephone || '')
          setAdresse1(d?.adresse1 || '')
          setAdresse2(d?.adresse2 || '')
          setIban(d?.iban || '')
          setBic(d?.bic || '')
          setBanqueAdresse(d?.banqueAdresse || '')
          setModePaiement(d?.modePaiement || '')
          setPieceIdentiteUrl(d?.pieceIdentiteUrl || '')
          setTrigramme(d?.trigramme || '')
        }
      } catch (e) {
        console.error('Erreur chargement profil deposante', e)
      } finally {
        setLoaded(true)
      }
    })
    return () => unsub()
  }, [])

  // =====================
  // CANVAS SIGNATURE
  // =====================
  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath(); ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
    isDrawingRef.current = true
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top); ctx.stroke()
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
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'
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
    txt('SIRET : 94189520300011 — Représenté par Salomé Kassabi', m, y); y += 22
    txt('Et le Déposant :', m, y, { bold: true }); y += 14
    txt(`${prenom} ${nom}`.toUpperCase(), m, y); y += 12
    if (adresse1) { txt(adresse1, m, y); y += 12 }
    if (adresse2) { txt(adresse2, m, y); y += 12 }
    txt(`${email}${telephone ? ' — ' + telephone : ''}`, m, y); y += 28

    const articles = [
      { n: 1, t: 'Objet', c: "Le présent contrat a pour objet de définir les conditions dans lesquelles le Déposant confie au Dépositaire des articles vestimentaires et accessoires de seconde main, afin qu'ils soient mis en vente en boutique et/ou sur la plateforme nouvellerive.eu, pour le compte et au nom du Déposant." },
      { n: 2, t: 'Durée', c: "Le contrat est conclu pour une durée de 30 jours à compter de la date de dépôt, renouvelable tacitement pour une nouvelle période de 30 jours. Le Déposant peut récupérer ses articles non vendus à l'issue de chaque période, sur rendez-vous en boutique." },
      { n: 3, t: 'Articles déposés', c: "Le dépôt est limité à 5 articles maximum. Le Déposant s'engage à déposer des articles en parfait état (propres, sans taches, sans accrocs, sans odeurs), conformes à la liste de produits acceptés sur nouvellerive.eu. Les Articles déposés sont référencés dans l'espace personnel du Déposant sur nouvellerive.eu — cette liste fait foi entre les parties. Le Déposant certifie en être le seul propriétaire et garantit leur authenticité." },
      { n: 4, t: 'Prix et baisse automatique', c: "Les prix sont fixés d'un commun accord lors du dépôt. Après 30 jours d'invendu, le prix pourra être réduit automatiquement. Passé 60 jours, les Articles non vendus seront disponibles à la récupération. À défaut dans les 7 jours suivant notification, ils pourront être remis en vente ou donnés à des associations partenaires." },
      { n: 5, t: 'Commission et reversement', c: "60 % reversés au Déposant en cas de règlement en espèces ou par virement — 70 % en cas de règlement en avoir boutique. Le reversement intervient dans les 30 jours suivant la vente. Le Déposant fera son affaire de ses obligations fiscales." },
      { n: 6, t: 'Obligations du Dépositaire', c: "Nouvelle Rive s'engage à assurer la garde et la conservation des Articles, à les exposer en boutique et/ou en ligne, et à verser au Déposant sa quote-part dans les délais convenus. Un récapitulatif des ventes est accessible via l'espace personnel sur nouvellerive.eu." },
      { n: 7, t: 'Assurances — Vol et sinistres', c: "Nouvelle Rive possède un système de sécurité (caméras, alarmes, antivols) et a souscrit une police d'assurance contre les sinistres. En cas de sinistre, Nouvelle Rive reversera au Déposant la quote-part de l'indemnité reçue, sans pouvoir être redevable d'un montant supérieur. Le Déposant reste libre de contracter sa propre assurance." },
      { n: 8, t: 'Obligations du Déposant', c: "Le Déposant s'engage à déposer et récupérer ses Articles à ses frais, en boutique sur rendez-vous. Il garantit l'authenticité des Articles et leur conformité à la législation. En cas de vice caché, la responsabilité lui incombe vis-à-vis de l'acheteur final." },
      { n: 9, t: 'Fin de contrat', c: "Chaque partie peut mettre fin au contrat par email. Les Articles invendus sont restitués dans un délai de 7 jours ouvrés sur rendez-vous, aux frais du Déposant." },
      { n: 10, t: 'Force majeure', c: "Les parties ne seront pas responsables de l'inexécution de leurs obligations en cas de force majeure. Le contrat sera suspendu jusqu'à reprise possible. Faute de reprise dans 30 jours, les parties se rapprocheront pour modifier ou résilier le contrat." },
      { n: 11, t: 'Droit applicable', c: "Le présent contrat est soumis au droit français. En cas de litige, les parties rechercheront une solution amiable avant tout recours judiciaire." },
    ]

    for (const art of articles) {
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
    txt(`Pour le Déposant — ${prenom} ${nom}`.toUpperCase(), pageW / 2, y, { bold: true }); y += 14
    txt('Salomé Kassabi', m, y); y += 40
    doc.addImage('data:image/png;base64,' + SIGNATURE_NR, 'PNG', m, y, 180, 106)
    txt('Signature NR1 SAS', m + 5, y + 118, { size: 7 })
    if (sigDataUrl && signed) {
      doc.addImage(sigDataUrl, 'PNG', pageW / 2, y, 220, 150)
    }
    txt('Signature du Déposant', pageW / 2 + 5, y + 162, { size: 7 })

    doc.save(`contrat_NR_${nom}_${format(new Date(), 'ddMMyy')}.pdf`)
    const token = await auth.currentUser?.getIdToken()
    if (token) await fetch('/api/deposante', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ contratSigne: true }) })
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
      if (data.url) setPieceIdentiteUrl(data.url)
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

  async function save() {
    setSaving(true)
    setMsg('')
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) { setMsg('❌ Non connecté'); setSaving(false); return }
      if (!trigramme && prenom && nom) {
        const base = generateTrigramme(prenom, nom)
        setTrigramme(base)
      }
      if (!pieceIdentiteUrl) setMsg('⚠️ N\'oubliez pas d\'ajouter votre pièce d\'identité')

      const res = await fetch('/api/deposante', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prenom, nom, trigramme, telephone, adresse1, adresse2, iban, bic, banqueAdresse, modePaiement, pieceIdentiteUrl }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Erreur')
      setMsg('Enregistré ✅')
    } catch (err: any) {
      setMsg('❌ ' + (err?.message || 'Erreur'))
    } finally {
      setSaving(false)
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
                <input value={prenom} onChange={e => setPrenom(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={label}>NOM *</label>
                <input value={nom} onChange={e => setNom(e.target.value)} style={inputStyle} />
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
                <input value={telephone} onChange={e => setTelephone(e.target.value)} style={inputStyle} placeholder="+33 6 xx xx xx xx" />
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={label}>ADRESSE (LIGNE 1) *</label>
              <input value={adresse1} onChange={e => setAdresse1(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={label}>ADRESSE (LIGNE 2)</label>
              <input value={adresse2} onChange={e => setAdresse2(e.target.value)} style={inputStyle} />
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
                <input value={iban} onChange={e => setIban(e.target.value)} style={inputStyle} placeholder="FR76 xxxx xxxx xxxx xxxx xxxx xxx" />
              </div>
              <div>
                <label style={label}>BIC *</label>
                <input value={bic} onChange={e => setBic(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={label}>ADRESSE DE LA BANQUE</label>
              <input value={banqueAdresse} onChange={e => setBanqueAdresse(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* MODE DE PAIEMENT */}
          <div style={{ borderBottom: '1px solid #000', padding: '32px 0' }}>
            <p style={{ ...label, marginBottom: '8px' }}>MODE DE PAIEMENT PRÉFÉRÉ</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              {(['cash', 'bon'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setModePaiement(mode)}
                  style={{
                    padding: '12px 24px',
                    border: '1px solid #000',
                    backgroundColor: modePaiement === mode ? '#000' : '#fff',
                    color: modePaiement === mode ? '#fff' : '#000',
                    cursor: 'pointer',
                    fontSize: '11px',
                    letterSpacing: '0.2em',
                    fontWeight: '600',
                  }}
                >
                  {mode === 'cash' ? 'VIREMENT (40%)' : "BON D'ACHAT (30%)"}
                </button>
              ))}
            </div>
          </div>

          {/* CONTRAT */}
          <div style={{ borderBottom: '1px solid #000', padding: '32px 0' }}>
            <p style={{ ...label, marginBottom: '8px' }}>CONTRAT DE DÉPÔT-VENTE</p>
            <p style={{ fontSize: '13px', color: '#444', marginBottom: '20px', lineHeight: '1.6' }}>
              En signant ci-dessous, vous acceptez les conditions du contrat de dépôt-vente Nouvelle Rive — durée 30 jours renouvelable, commission 40% virement / 30% avoir, 5 articles maximum, articles en parfait état.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={label}>VOTRE SIGNATURE</span>
              <button onClick={clearCanvas} style={{ fontSize: '11px', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>Effacer</button>
            </div>
            <canvas
              ref={canvasRef}
              width={640}
              height={140}
              style={{ width: '100%', border: '1px solid #000', cursor: 'crosshair', backgroundColor: '#fafafa', display: 'block', touchAction: 'none' }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDrawTouch}
              onTouchMove={drawTouch}
              onTouchEnd={stopDraw}
            />
            <p style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>Signez avec la pointe du doigt dans le cadre ci-dessus</p>
            <button
              onClick={generateContratPDF}
              style={{ marginTop: '16px', padding: '12px 24px', backgroundColor: '#000', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
            >
              TÉLÉCHARGER LE CONTRAT SIGNÉ (PDF)
            </button>
          </div>

          {/* SAVE */}
          <div style={{ paddingTop: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={save}
              disabled={saving}
              style={{ padding: '14px 32px', backgroundColor: bleu, color: '#fff', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'ENREGISTREMENT...' : 'ENREGISTRER'}
            </button>
            {msg && <span style={{ fontSize: '13px', color: msg.includes('❌') ? 'red' : 'green' }}>{msg}</span>}
          </div>

        </div>
      </div>
    </div>
  )
}