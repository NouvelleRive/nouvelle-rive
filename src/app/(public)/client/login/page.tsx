// app/(public)/client/login/page.tsx
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isSignup) {
        await createUserWithEmailAndPassword(auth, email, password)
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
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-gray-50 px-4 py-12">
      <div className="w-full max-w-3xl space-y-6">

        <div className="text-center">
          <h1 className="text-3xl font-bold" style={{ color: '#22209C' }}>NOUVELLE RIVE</h1>
        </div>

        <div className="flex gap-6 items-start">

          {/* COLONNE GAUCHE — Formulaire */}
          <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-xl font-bold uppercase leading-tight" style={{ color: '#22209C' }}>Mon compte<br/>client</h2>

            {/* Google */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 bg-white text-gray-700 py-3 rounded-lg hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition font-medium"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {loading ? 'Connexion...' : 'Continuer avec Google'}
            </button>

            {/* Séparateur */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-white text-gray-400 text-xs">ou avec email</span>
              </div>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignup && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                    <input
                      type="text"
                      value={prenom}
                      onChange={(e) => setPrenom(e.target.value)}
                      required
                      className="w-full border border-gray-200 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                    <input
                      type="text"
                      value={nom}
                      onChange={(e) => setNom(e.target.value)}
                      required
                      className="w-full border border-gray-200 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C] transition"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-200 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C] transition"
                  placeholder="ton@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full border border-gray-200 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C] transition"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#22209C] text-white py-2.5 rounded-lg hover:bg-[#1a1875] disabled:opacity-50 transition font-medium"
              >
                {loading ? 'Chargement...' : isSignup ? 'Créer mon compte' : 'Se connecter'}
              </button>
            </form>

            <button
              onClick={() => setIsSignup(!isSignup)}
              className="w-full text-sm text-center hover:underline"
              style={{ color: '#22209C' }}
            >
              {isSignup ? 'Déjà un compte ? Se connecter' : 'Pas encore de compte ? Créer un compte'}
            </button>

            <div className="text-center">
              <Link href="/boutique" className="text-sm text-gray-400 hover:underline">
                ← Retour à la boutique
              </Link>
            </div>
          </div>

          {/* COLONNE DROITE — Vendre chez NR */}
          <div className="w-72 bg-[#22209C] rounded-xl p-6 text-white space-y-6">
            <h2 className="text-xl font-bold uppercase leading-tight">Vendre chez<br/>Nouvelle Rive</h2>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Je suis un particulier</p>
              <Link href="/client/deposant/inscription" className="text-sm underline opacity-80 hover:opacity-100">
                Découvrir nos conditions
              </Link>

              <form onSubmit={handleSubmit} className="space-y-2 mt-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="ton@email.com"
                  className="w-full border border-white/40 bg-white/10 text-white placeholder-white/50 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-white"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full border border-white/40 bg-white/10 text-white placeholder-white/50 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-white"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-white text-[#22209C] rounded-lg hover:bg-gray-100 transition text-sm font-semibold uppercase tracking-wider"
                >
                  {loading ? 'Connexion...' : 'Se connecter'}
                </button>
              </form>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Je suis un professionnel</p>
              <a
                href="mailto:nouvelleriveparis@gmail.com"
                className="block text-center py-2.5 border border-white rounded-lg hover:bg-white hover:text-[#22209C] transition text-sm font-semibold uppercase tracking-wider"
              >
                Contacter Nouvelle Rive
              </a>
            </div>
          </div>

        </div>
      </div>
    </main>
  )
}