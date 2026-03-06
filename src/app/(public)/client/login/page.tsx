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
      <div className="px-6 py-12 flex gap-12 items-start">
        <div className="flex-1">
        {/* Titre */}      

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

        {/* COLONNE DROITE — Vendre chez NR */}
        <div className="w-72 shrink-0" style={{ border: '2px solid #0000FF' }}>
          <div className="p-6">
            <h2 className="uppercase mb-6" style={{ fontSize: '20px', letterSpacing: '0.05em', fontWeight: '700' }}>Vendre chez<br/>NOUVELLE RIVE</h2>
            <div className="mb-4">
              <p className="uppercase mb-3" style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>Je suis un particulier</p>
              <div className="space-y-2">
                <Link href="/client/deposant/inscription" className="block text-center py-2 border border-black hover:bg-black hover:text-white transition-colors uppercase" style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>
                  Découvrir nos conditions
                </Link>
                <Link href="/client/login" className="block text-center py-2 bg-black text-white hover:bg-gray-800 transition-colors uppercase" style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>
                  Me connecter
                </Link>
              </div>
            </div>
            <div>
              <p className="uppercase mb-3" style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>Je suis un professionnel</p>
              <a href="mailto:nouvelleriveparis@gmail.com" className="block text-center py-2 border border-black hover:bg-black hover:text-white transition-colors uppercase" style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>
                Contacter Nouvelle Rive
              </a>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}