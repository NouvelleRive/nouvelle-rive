'use client'

import { useEffect, useState } from 'react'
import { auth, db } from '@/lib/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore'

export default function ProfilFacturationPage() {
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const [raisonSociale, setRaisonSociale] = useState('')
  const [siret, setSiret] = useState('')
  const [adresse1, setAdresse1] = useState('')
  const [adresse2, setAdresse2] = useState('')
  const [tva, setTva] = useState('')
  const [iban, setIban] = useState('')
  const [bic, setBic] = useState('')
  const [banqueAdresse, setBanqueAdresse] = useState('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return
      const ref = doc(db, 'chineuse', u.uid)
      const snap = await getDoc(ref)
      if (snap.exists()) {
        const d = snap.data() as any
        setRaisonSociale(d?.nom || '')
        setSiret(d?.siret || '')
        setAdresse1(d?.adresse1 || '')
        setAdresse2(d?.adresse2 || '')
        setTva(d?.tva || '')
        setIban(d?.iban || '')
        setBic(d?.bic || '')
        setBanqueAdresse(d?.banqueAdresse || '')
      } else {
        // si le doc n'existe pas encore, on le crée à l’enregistrement
      }
      setLoaded(true)
    })
    return () => unsub()
  }, [])

  async function save() {
    setSaving(true); setMsg('')
    const u = auth.currentUser
    if (!u) return
    const ref = doc(db, 'chineuse', u.uid)
    const payload = {
      nom: raisonSociale, // utilisé comme “nom de la chineuse” sur la facture
      siret, adresse1, adresse2, tva,
      iban, bic, banqueAdresse,
      email: u.email || null,
    }
    // crée si absent, sinon met à jour
    const snap = await getDoc(ref)
    if (!snap.exists()) await setDoc(ref, payload, { merge: true })
    else await updateDoc(ref, payload as any)

    setMsg('Enregistré ✅')
    setSaving(false)
  }

  if (!loaded) return null

  return (
    <>
      <main className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-primary mb-4">Mon profil</h1>
        <p className="text-sm text-gray-600 mb-6">
          Ces informations apparaîtront sur vos factures.
        </p>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Nom / Raison sociale</label>
            <input value={raisonSociale} onChange={e=>setRaisonSociale(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">SIRET</label>
            <input value={siret} onChange={e=>setSiret(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Adresse (ligne 1)</label>
            <input value={adresse1} onChange={e=>setAdresse1(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Adresse (ligne 2)</label>
            <input value={adresse2} onChange={e=>setAdresse2(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Numéro de TVA</label>
            <input value={tva} onChange={e=>setTva(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">IBAN</label>
              <input value={iban} onChange={e=>setIban(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">BIC</label>
              <input value={bic} onChange={e=>setBic(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Adresse de la banque</label>
            <input value={banqueAdresse} onChange={e=>setBanqueAdresse(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>

          <div className="pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded text-white"
              style={{ background: '#22209C', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {msg && <span className="ml-3 text-sm text-green-700">{msg}</span>}
          </div>
        </div>
      </main>
    </>
  )
}
