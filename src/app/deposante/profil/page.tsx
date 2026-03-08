'use client'

import { useEffect, useState, useRef } from 'react'
import { auth, db } from '@/lib/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'

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

  const fileInputRef = useRef<HTMLInputElement>(null)

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
      if (!u) return
      setEmail(u.email || '')
      setCurrentUid(u.uid)

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
      setLoaded(true)
    })
    return () => unsub()
  }, [])

  async function handleUploadId(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingId(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      const ext = file.name.split('.').pop()
      const filename = `pieces-identite/${auth.currentUser?.uid}.${ext}`
      const res = await fetch(`/api/bunny-upload?filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(file.type)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: file,
      })
      const data = await res.json()
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
      if (!pieceIdentiteUrl) { setMsg('❌ Pièce d\'identité obligatoire'); setSaving(false); return }

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
            <div>
              <label style={label}>TRIGRAMME</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  value={trigramme}
                  onChange={e => setTrigramme(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
                  style={{ ...inputStyle, width: '120px', fontWeight: '700', letterSpacing: '0.2em' }}
                  placeholder="EX: MAD"
                  maxLength={4}
                />
                <button
                  onClick={handleGenerateTrigramme}
                  disabled={generatingTri || (!prenom && !nom)}
                  style={{ padding: '10px 16px', border: '1px solid #000', backgroundColor: '#fff', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.15em', fontWeight: '600', opacity: generatingTri || (!prenom && !nom) ? 0.4 : 1 }}
                >
                  {generatingTri ? '...' : 'GÉNÉRER'}
                </button>
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
            <p style={{ fontSize: '12px', color: '#666', marginBottom: '20px' }}>CNI ou passeport obligatoire. Document stocké de façon sécurisée, utilisé uniquement pour vérification.</p>
            {pieceIdentiteUrl ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '80px', height: '52px', border: '1px solid #000', backgroundImage: `url(${pieceIdentiteUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                <div>
                  <p style={{ fontSize: '12px', color: '#444', marginBottom: '6px' }}>Document enregistré ✅</p>
                  <button onClick={() => fileInputRef.current?.click()} style={{ fontSize: '11px', letterSpacing: '0.15em', fontWeight: '600', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Remplacer
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingId}
                style={{ padding: '12px 24px', border: '1px solid #000', backgroundColor: '#fff', cursor: 'pointer', fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
              >
                {uploadingId ? 'UPLOAD EN COURS...' : 'AJOUTER UN DOCUMENT →'}
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={handleUploadId} />
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
                  {mode === 'cash' ? 'VIREMENT (40%)' : 'BON D\'ACHAT (30%)'}
                </button>
              ))}
            </div>
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