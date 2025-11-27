// app/client/profil/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { onAuthStateChanged, updateProfile, User } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebaseConfig'

type UserProfile = {
  nom: string
  prenom: string
  telephone: string
  adresse: string
  codePostal: string
  ville: string
}

export default function ProfilPage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile>({
    nom: '',
    prenom: '',
    telephone: '',
    adresse: '',
    codePostal: '',
    ville: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const fontHelvetica = '"Helvetica Neue", Helvetica, Arial, sans-serif'
  const bleuElectrique = '#0000FF'

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/client/login')
        return
      }
      
      setUser(currentUser)
      
      // Charger le profil
      try {
        const docRef = doc(db, 'users', currentUser.uid)
        const docSnap = await getDoc(docRef)
        
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile)
        }
      } catch (error) {
        console.error('Erreur chargement profil:', error)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    setMessage('')

    try {
      // Sauvegarder dans Firestore
      await setDoc(doc(db, 'users', user.uid), profile)
      
      // Mettre à jour le displayName
      await updateProfile(user, {
        displayName: `${profile.prenom} ${profile.nom}`
      })

      setMessage('Profil mis à jour avec succès !')
      setTimeout(() => setMessage(''), 3000)
    } catch (error) {
      setMessage('Erreur lors de la sauvegarde')
      console.error(error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: fontHelvetica }}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/client" className="text-sm hover:underline">
            ← Retour à mon compte
          </Link>
        </div>

        <h1 
          className="uppercase mb-8"
          style={{ 
            fontSize: '48px',
            fontWeight: '700',
            letterSpacing: '-0.01em',
            lineHeight: '1'
          }}
        >
          MON PROFIL
        </h1>

        <div style={{ borderBottom: '1px solid #000' }} className="mb-8" />

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label 
                className="block mb-2"
                style={{ 
                  fontSize: '11px',
                  letterSpacing: '0.2em',
                  fontWeight: '600'
                }}
              >
                PRÉNOM *
              </label>
              <input
                type="text"
                value={profile.prenom}
                onChange={(e) => setProfile({...profile, prenom: e.target.value})}
                className="w-full px-4 py-3 border border-black focus:outline-none focus:border-blue-600"
                required
              />
            </div>

            <div>
              <label 
                className="block mb-2"
                style={{ 
                  fontSize: '11px',
                  letterSpacing: '0.2em',
                  fontWeight: '600'
                }}
              >
                NOM *
              </label>
              <input
                type="text"
                value={profile.nom}
                onChange={(e) => setProfile({...profile, nom: e.target.value})}
                className="w-full px-4 py-3 border border-black focus:outline-none focus:border-blue-600"
                required
              />
            </div>
          </div>

          <div>
            <label 
              className="block mb-2"
              style={{ 
                fontSize: '11px',
                letterSpacing: '0.2em',
                fontWeight: '600'
              }}
            >
              EMAIL
            </label>
            <input
              type="email"
              value={user?.email || ''}
              className="w-full px-4 py-3 border border-gray-300 bg-gray-50"
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">
              L'email ne peut pas être modifié
            </p>
          </div>

          <div>
            <label 
              className="block mb-2"
              style={{ 
                fontSize: '11px',
                letterSpacing: '0.2em',
                fontWeight: '600'
              }}
            >
              TÉLÉPHONE
            </label>
            <input
              type="tel"
              value={profile.telephone}
              onChange={(e) => setProfile({...profile, telephone: e.target.value})}
              className="w-full px-4 py-3 border border-black focus:outline-none focus:border-blue-600"
            />
          </div>

          <div style={{ borderBottom: '1px solid #000' }} className="my-8" />

          <h2 
            className="uppercase mb-4"
            style={{ 
              fontSize: '18px',
              fontWeight: '600',
              letterSpacing: '0.1em'
            }}
          >
            ADRESSE DE LIVRAISON
          </h2>

          <div>
            <label 
              className="block mb-2"
              style={{ 
                fontSize: '11px',
                letterSpacing: '0.2em',
                fontWeight: '600'
              }}
            >
              ADRESSE
            </label>
            <input
              type="text"
              value={profile.adresse}
              onChange={(e) => setProfile({...profile, adresse: e.target.value})}
              className="w-full px-4 py-3 border border-black focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label 
                className="block mb-2"
                style={{ 
                  fontSize: '11px',
                  letterSpacing: '0.2em',
                  fontWeight: '600'
                }}
              >
                CODE POSTAL
              </label>
              <input
                type="text"
                value={profile.codePostal}
                onChange={(e) => setProfile({...profile, codePostal: e.target.value})}
                className="w-full px-4 py-3 border border-black focus:outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label 
                className="block mb-2"
                style={{ 
                  fontSize: '11px',
                  letterSpacing: '0.2em',
                  fontWeight: '600'
                }}
              >
                VILLE
              </label>
              <input
                type="text"
                value={profile.ville}
                onChange={(e) => setProfile({...profile, ville: e.target.value})}
                className="w-full px-4 py-3 border border-black focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {message && (
            <div 
              className="text-center py-2"
              style={{ 
                color: message.includes('succès') ? '#22C55E' : '#EF4444',
                fontSize: '12px',
                letterSpacing: '0.1em'
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 transition-all duration-200 hover:opacity-80"
            style={{ 
              backgroundColor: bleuElectrique,
              color: 'white',
              fontSize: '11px',
              letterSpacing: '0.2em',
              fontWeight: '600'
            }}
          >
            {saving ? 'ENREGISTREMENT...' : 'ENREGISTRER MES INFORMATIONS'}
          </button>
        </form>
      </div>
    </div>
  )
}