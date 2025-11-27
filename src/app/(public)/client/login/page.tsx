// app/client/login/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider 
} from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const fontHelvetica = '"Helvetica Neue", Helvetica, Arial, sans-serif'
  const bleuElectrique = '#0000FF'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password)
        // Sauvegarder les infos utilisateur dans Firestore
        // TODO: ajouter doc dans collection 'users'
      } else {
        await signInWithEmailAndPassword(auth, email, password)
      }
      router.push('/client')
    } catch (err: any) {
      setError(
        err.code === 'auth/email-already-in-use' 
          ? 'Cet email est déjà utilisé'
          : err.code === 'auth/wrong-password'
          ? 'Mot de passe incorrect'
          : err.code === 'auth/user-not-found'
          ? 'Aucun compte avec cet email'
          : 'Erreur de connexion'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      router.push('/client')
    } catch (err) {
      setError('Erreur de connexion avec Google')
    }
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: fontHelvetica }}>
      <div className="max-w-md mx-auto px-6 py-12">
        {/* Titre */}
        <h1 
          className="uppercase text-center mb-8"
          style={{ 
            fontSize: '48px',
            fontWeight: '700',
            letterSpacing: '-0.01em',
            lineHeight: '1'
          }}
        >
          {isSignup ? 'CRÉER UN COMPTE' : 'SE CONNECTER'}
        </h1>

        <div style={{ borderBottom: '1px solid #000' }} className="mb-8" />

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {isSignup && (
            <>
              <div>
                <label 
                  className="block mb-2"
                  style={{ 
                    fontSize: '11px',
                    letterSpacing: '0.2em',
                    fontWeight: '600'
                  }}
                >
                  PRÉNOM
                </label>
                <input
                  type="text"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
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
                  NOM
                </label>
                <input
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className="w-full px-4 py-3 border border-black focus:outline-none focus:border-blue-600"
                  required
                />
              </div>
            </>
          )}

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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              MOT DE PASSE
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-black focus:outline-none focus:border-blue-600"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 transition-all duration-200 hover:opacity-80"
            style={{ 
              backgroundColor: bleuElectrique,
              color: 'white',
              fontSize: '11px',
              letterSpacing: '0.2em',
              fontWeight: '600'
            }}
          >
            {loading ? 'CHARGEMENT...' : isSignup ? 'CRÉER MON COMPTE' : 'SE CONNECTER'}
          </button>
        </form>

        {/* Séparateur */}
        <div className="my-6 text-center text-gray-400 text-sm">OU</div>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          className="w-full py-3 border border-black transition-all duration-200 hover:bg-gray-50"
          style={{ 
            fontSize: '11px',
            letterSpacing: '0.2em',
            fontWeight: '600'
          }}
        >
          CONTINUER AVEC GOOGLE
        </button>

        {/* Toggle */}
        <div className="mt-8 text-center">
          <button
            onClick={() => setIsSignup(!isSignup)}
            className="text-sm hover:underline"
            style={{ color: bleuElectrique }}
          >
            {isSignup 
              ? 'Déjà un compte ? Se connecter' 
              : 'Pas encore de compte ? Créer un compte'}
          </button>
        </div>

        {/* Lien retour */}
        <div className="mt-8 text-center">
          <Link 
            href="/boutique"
            className="text-sm hover:underline"
          >
            ← Retour à la boutique
          </Link>
        </div>
      </div>
    </div>
  )
}