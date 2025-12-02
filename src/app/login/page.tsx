'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
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
      // Forcer la sélection du compte Google
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      })
      
      const result = await signInWithPopup(auth, googleProvider)
      redirectByRole(result.user.email)
    } catch (err: any) {
      console.error('Erreur Google :', err.code, err.message)
      
      if (err.code === 'auth/popup-closed-by-user') {
        setError("Connexion annulée.")
      } else if (err.code === 'auth/popup-blocked') {
        setError("Popup bloquée. Autorise les popups pour ce site.")
      } else if (err.code === 'auth/unauthorized-domain') {
        setError("Ce domaine n'est pas autorisé. Contacte l'admin.")
      } else if (err.code === 'auth/cancelled-popup-request') {
        // Ignore - l'utilisateur a cliqué plusieurs fois
      } else {
        setError("Échec de la connexion Google. Réessaye.")
      }
    } finally {
      setLoading(false)
    }
  }

  // Reset mot de passe - SIMPLIFIÉ (sans fetchSignInMethodsForEmail)
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResetMessage('')
    setLoading(true)
    
    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      })
      setResetMessage("Si un compte existe avec cet email, tu recevras un lien de réinitialisation. Vérifie aussi tes spams !")
      // Ne pas fermer le modal pour que l'utilisateur voie le message
    } catch (err: any) {
      console.error('Reset error:', err.code, err.message)
      
      if (err.code === 'auth/invalid-email') {
        setError("Format d'email invalide.")
      } else if (err.code === 'auth/too-many-requests') {
        setError("Trop de demandes. Attends quelques minutes.")
      } else {
        // Message générique pour ne pas révéler si l'email existe
        setResetMessage("Si un compte existe avec cet email, tu recevras un lien. Vérifie tes spams !")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-gray-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold" style={{ color: '#22209C' }}>
            NOUVELLE RIVE
          </h1>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 space-y-4">
          {!showReset ? (
            <>
              {/* Bouton Google - Principal */}
              <button
                type="button"
                onClick={handleGoogleLogin}
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

              <p className="text-xs text-center text-gray-400">
                Recommandé pour les chineuses
              </p>

              {/* Séparateur */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-gray-400 text-xs">ou avec email</span>
                </div>
              </div>

              {/* Formulaire email/password */}
              <form onSubmit={handleLogin} className="space-y-4">
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
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full border border-gray-200 px-4 py-2.5 rounded-lg pr-10 focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C] transition"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg">
                    {error}
                  </div>
                )}
                {resetMessage && (
                  <div className="bg-green-50 border border-green-200 text-green-600 text-sm p-3 rounded-lg">
                    {resetMessage}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#22209C] text-white py-2.5 rounded-lg hover:bg-[#1a1875] disabled:opacity-50 transition font-medium"
                >
                  {loading ? 'Connexion...' : 'Se connecter'}
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
              <div className="text-center mb-2">
                <h2 className="text-lg font-semibold text-gray-900">Réinitialiser le mot de passe</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Entre ton email pour recevoir un lien de réinitialisation.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ton email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-200 px-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C] transition"
                  placeholder="ton@email.com"
                />
              </div>

              {resetMessage && (
                <div className="bg-green-50 border border-green-200 text-green-600 text-sm p-3 rounded-lg">
                  ✅ {resetMessage}
                </div>
              )}
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
                {loading ? 'Envoi...' : 'Envoyer le lien'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowReset(false)
                  setError('')
                  setResetMessage('')
                }}
                className="w-full text-gray-500 hover:text-gray-700 text-sm py-2"
              >
                ← Retour à la connexion
              </button>
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