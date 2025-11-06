'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
} from 'firebase/auth'
import { auth } from '@/lib/firebaseConfig'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showReset, setShowReset] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      alert('Connecté ✅')
      router.push('/formulaire')
    } catch (err: any) {
      setError("Échec de la connexion. Vérifie ton email ou ton mot de passe.")
      console.error('Erreur Firebase :', err.code, err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setResetMessage('')
    try {
      const methods = await fetchSignInMethodsForEmail(auth, email)
      if (!methods.includes('password')) {
        setError("Aucun compte email/mot de passe associé à cet email.")
        return
      }
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/login?reset=ok`,
        handleCodeInApp: false,
      })
      setResetMessage("Si un compte existe, un email de réinitialisation a été envoyé ✅ (vérifie tes spams).")
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
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full mt-1 border px-3 py-2 rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full mt-1 border px-3 py-2 rounded"
                />
              </div>

              {error && <p className="text-red-600 text-sm">{error}</p>}

              {/* Bouton bleu Nouvelle Rive */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-2 rounded hover:opacity-90 disabled:opacity-50"
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
                  className="text-primary hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4">
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
                Envoyer le lien de réinitialisation
              </button>

              <p className="text-sm text-center">
                <button
                  type="button"
                  onClick={() => setShowReset(false)}
                  className="text-gray-600 hover:underline"
                >
                  ← Retour à la connexion
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
