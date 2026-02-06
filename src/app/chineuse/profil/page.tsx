'use client'

import { useEffect, useState } from 'react'
import { auth, db } from '@/lib/firebaseConfig'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'

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
  const [texteEcoCirculaire, setTexteEcoCirculaire] = useState(1)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return
      
      // Chercher par authUid, puis fallback par email
      let snap = await getDocs(
        query(collection(db, 'chineuse'), where('authUid', '==', u.uid))
      )

      if (snap.empty && u.email) {
        snap = await getDocs(
          query(collection(db, 'chineuse'), where('email', '==', u.email))
        )
      }
      
      if (!snap.empty) {
        const d = snap.docs[0].data()
        setRaisonSociale(d?.nom || '')
        setSiret(d?.siret || '')
        setAdresse1(d?.adresse1 || '')
        setAdresse2(d?.adresse2 || '')
        setTva(d?.tva || '')
        setIban(d?.iban || '')
        setBic(d?.bic || '')
        setBanqueAdresse(d?.banqueAdresse || '')
        setTexteEcoCirculaire(d?.texteEcoCirculaire || 1)
      }
      setLoaded(true)
    })
    return () => unsub()
  }, [])

  async function save() {
    setSaving(true)
    setMsg('')
    
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) {
        setMsg('❌ Non connecté')
        setSaving(false)
        return
      }

      const res = await fetch('/api/deposantes', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nom: raisonSociale,
          siret,
          adresse1,
          adresse2,
          tva,
          iban,
          bic,
          banqueAdresse,
          texteEcoCirculaire,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur')
      }

      setMsg('Enregistré ✅')
    } catch (err: any) {
      setMsg('❌ ' + (err?.message || 'Erreur'))
    } finally {
      setSaving(false)
    }
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

          <div>
            <label className="block text-sm font-medium mb-1">Texte économie circulaire</label>
            <select
              value={texteEcoCirculaire}
              onChange={(e) => setTexteEcoCirculaire(parseInt(e.target.value))}
              className="w-full border rounded px-3 py-2"
            >
              <option value={1}>Seconde main (vintage)</option>
              <option value={2}>Upcycling</option>
              <option value={3}>Régénéré</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">Ce texte s'affichera sur vos fiches produit dans "Économie circulaire et engagement".</p>
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