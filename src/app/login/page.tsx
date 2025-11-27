'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
} from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'

const googleProvider = new GoogleAuthProvider()

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'
const VENDEUSE_EMAIL = 'nouvellerivecommandes@gmail.com'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Redirection selon le rôle
  const redirectByRole = (userEmail: string | null) => {
    if (userEmail === ADMIN_EMAIL) {
      router.push('/admin/nos-produits')
    } else if (userEmail === VENDEUSE_EMAIL) {
      router.push('/vendeuse/commandes')
    } else {
      router.push('/chineuse/formulaire')
    }
  }

  // Connexion email/password
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await signInWithEmailAndPassword(auth, email, password)
      redirectByRole(user.user.email)
    } catch (err: any) {
      console.error('Erreur Firebase :', err.code, err.message)
      
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError("Email ou mot de passe incorrect.")
      } else if (err.code === 'auth/user-not-found') {
        setError("Aucun compte trouvé avec cet email.")
      } else if (err.code === 'auth/too-many-requests') {
        setError("Trop de tentatives. Réessaye plus tard ou utilise Google.")
      } else {
        setError("Échec de la connexion. Essaye avec Google.")
      }
    } finally {
      setLoading(false)
    }
  }

  // Connexion Google
  const handleGoogleLogin = async () => {
    setError('')
    setLoading(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      redirectByRole(result.user.email)
    } catch (err: any) {
      console.error('Erreur Google :', err.code, err.message)
      
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Connexion annulée.")
      } else if (err.code === 'auth/popup-blocked') {
        setError("Popup bloquée. Autorise les popups pour ce site.")
      } else {
        setError("Échec de la connexion Google.")
      }
    } finally {
      setLoading(false)
    }
  }

  // Reset mot de passe
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResetMessage('')
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email)
      if (methods.length === 0) {
        setError("Aucun compte trouvé avec cet email.")
        return
      }
      if (!methods.includes('password')) {
        setError("Ce compte utilise Google. Connecte-toi avec le bouton Google.")
        return
      }
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/login?reset=ok`,
        handleCodeInApp: false,
      })
      setResetMessage("Email de réinitialisation envoyé ✅ (vérifie tes spams)")
      setShowReset(false)
    } catch (err: any) {
      console.error('Reset error:', err.code, err.message)
      setError("Impossible d'envoyer l'email de réinitialisation.")
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-3xl font-bold text-center" style={{ color: '#22209C' }}>
          NOUVELLE RIVE
        </h1>

        <div className="border rounded-lg shadow p-6 space-y-4">
          {!showReset ? (
            <>
              {/* Bouton Google */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 border border-gray-300 bg-white text-gray-700 py-2.5 rounded hover:bg-gray-50 disabled:opacity-50 transition"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuer avec Google
              </button>

              {/* Séparateur */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">ou</span>
                </div>
              </div>

              {/* Formulaire email/password */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full mt-1 border px-3 py-2 rounded"
                    placeholder="ton@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full mt-1 border px-3 py-2 rounded pr-10"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                          <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                          <circle cx="12" cy="12" r="3"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                {error && <p className="text-red-600 text-sm">{error}</p>}
                {resetMessage && <p className="text-green-600 text-sm">{resetMessage}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#22209C] text-white py-2 rounded hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? '...' : 'Se connecter'}
                </button>

                <p className="text-sm text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowReset(true)
                      setError('')
                      setResetMessage('')
                    }}
                    className="text-[#22209C] hover:underline"
                  >
                    Mot de passe oublié ?
                  </button>
                </p>
              </form>
            </>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <p className="text-sm text-gray-600">
                Entre ton email pour recevoir un lien de réinitialisation.
              </p>
              <div>
                <label className="block text-sm font-medium">Ton email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full mt-1 border px-3 py-2 rounded"
                />
              </div>

              {resetMessage && <p className="text-green-600 text-sm">{resetMessage}</p>}
              {error && <p className="text-red-600 text-sm">{error}</p>}

              <button
                type="submit"
                className="w-full bg-[#22209C] text-white py-2 rounded hover:opacity-90"
              >
                Envoyer le lien
              </button>

              <p className="text-sm text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowReset(false)
                    setError('')
                  }}
                  className="text-gray-600 hover:underline"
                >
                  ← Retour
                </button>
              </p>
            </form>
          )}
        </div>

        <p className="text-xs text-center text-gray-400">
          Pas encore de compte ? Contacte Nouvelle Rive
        </p>
      </div>
    </main>
  )
}