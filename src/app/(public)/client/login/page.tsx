'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/firebaseConfig'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail
} from 'firebase/auth'

// Détection des navigateurs in-app (WhatsApp, Instagram, Facebook, etc.)
// qui cassent Firebase Auth à cause de sessionStorage partitionné
function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /FBAN|FBAV|Instagram|WhatsApp|Line\/|Twitter|TikTok|Snapchat|LinkedInApp/i.test(ua)
}

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inApp, setInApp] = useState(false)

  useEffect(() => {
    setInApp(isInAppBrowser())
  }, [])

  // Col 1 — Client
  const [emailClient, setEmailClient] = useState('')
  const [passwordClient, setPasswordClient] = useState('')
  const [isSignupClient, setIsSignupClient] = useState(false)
  const [nomClient, setNomClient] = useState('')
  const [prenomClient, setPrenomClient] = useState('')

  // Col 2 — Déposante
  const [emailDeposante, setEmailDeposante] = useState('')
  const [passwordDeposante, setPasswordDeposante] = useState('')
  const [isSignupDeposante, setIsSignupDeposante] = useState(false)
  const [showPasswordDeposante, setShowPasswordDeposante] = useState(false)

  // Col 3 — Pro
  const [emailPro, setEmailPro] = useState('')
  const [passwordPro, setPasswordPro] = useState('')
  const [isSignupPro] = useState(false)

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      if (isSignupClient) await createUserWithEmailAndPassword(auth, emailClient, passwordClient)
      else await signInWithEmailAndPassword(auth, emailClient, passwordClient)
      router.push('/client')
    } catch (err: any) {
      setError(err.code === 'auth/email-already-in-use' ? 'Email déjà utilisé' : err.code === 'auth/wrong-password' ? 'Mot de passe incorrect' : err.code === 'auth/user-not-found' ? 'Aucun compte avec cet email' : 'Erreur de connexion')
    } finally { setLoading(false) }
  }

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
      router.push('/client')
    } catch { setError('Erreur Google') }
  }

  const handleForgotPassword = async (email: string) => {
    if (!email) { setError("Entre ton email d'abord"); return }
    try {
      await sendPasswordResetEmail(auth, email)
      setError('Email de réinitialisation envoyé !')
    } catch { setError('Erreur, vérifie ton email') }
  }

  const handleDeposanteSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      let userCredential
      if (isSignupDeposante) {
        userCredential = await createUserWithEmailAndPassword(auth, emailDeposante, passwordDeposante)
        const token = await userCredential.user.getIdToken()
        await fetch('/api/deposante', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ email: emailDeposante })
        })
      } else {
        await signInWithEmailAndPassword(auth, emailDeposante, passwordDeposante)
      }
      router.push('/deposante/profil')
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') setError('Email déjà utilisé')
      else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') setError('Mot de passe incorrect')
      else if (err.code === 'auth/user-not-found') setError('Aucun compte avec cet email')
      else setError('Erreur de connexion')
    } finally { setLoading(false) }
  }

  const handleProSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      if (isSignupPro) await createUserWithEmailAndPassword(auth, emailPro, passwordPro)
      else await signInWithEmailAndPassword(auth, emailPro, passwordPro)
      router.push('/chineuse/formulaire')
    } catch (err: any) {
      setError('Erreur de connexion')
    } finally { setLoading(false) }
  }

  const inputCls = "w-full border border-gray-200 px-4 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C] transition text-sm"
  const btnCls = "w-full bg-[#22209C] text-white py-1.5 rounded-lg hover:bg-[#1a1875] disabled:opacity-50 transition font-medium text-sm"

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-gray-50 px-4 py-12">
      <div className="w-full max-w-5xl">

        {inApp && (
          <div className="mb-4 bg-amber-50 border border-amber-300 text-amber-800 text-sm p-4 rounded-lg">
            <p className="font-semibold mb-1">⚠️ Ouvre cette page dans Safari ou Chrome</p>
            <p className="text-xs">
              La connexion ne fonctionne pas dans le navigateur de WhatsApp/Instagram/Facebook.
              Appuie sur les <strong>••• en haut à droite</strong> puis <strong>« Ouvrir dans le navigateur »</strong>.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded-lg text-center">{error}</div>
        )}

        {/* GRILLE PRINCIPALE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-0 md:bg-white md:border md:border-gray-200 md:rounded-xl md:shadow-sm">

          {/* ── COLONNE 1 : CLIENT ── */}
          <div className="flex flex-col px-6 py-5 space-y-2 bg-white border border-gray-200 rounded-xl shadow-sm md:border-0 md:rounded-none md:shadow-none">
            <h2 className="text-xl font-bold uppercase" style={{ color: '#22209C' }}>
              Mon compte client
              {isSignupClient && <span className="ml-2 text-xs font-normal bg-[#22209C] text-white px-2 py-0.5 rounded-full">Créer un compte</span>}
            </h2>
            <p className="text-xs text-gray-500">Je veux revoir les pépites que j'ai achetées &amp; paramétrer mes alertes.</p>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 bg-white text-gray-700 py-1.5 rounded-lg hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition font-medium text-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuer avec Google
            </button>
            {isSignupClient && (
              <div className="grid grid-cols-2 gap-2">
                <input value={prenomClient} onChange={e => setPrenomClient(e.target.value)} placeholder="Prénom" className={inputCls} />
                <input value={nomClient} onChange={e => setNomClient(e.target.value)} placeholder="Nom" className={inputCls} />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={emailClient} onChange={e => setEmailClient(e.target.value)} required className={inputCls} placeholder="ton@email.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mot de passe</label>
              <input type="password" value={passwordClient} onChange={e => setPasswordClient(e.target.value)} required minLength={6} className={inputCls} placeholder="••••••••" />
              {!isSignupClient && (
                <button type="button" onClick={() => handleForgotPassword(emailClient)} className="text-xs text-gray-400 hover:underline mt-1 block">
                  Mot de passe oublié ?
                </button>
              )}
            </div>
            <button onClick={handleClientSubmit} disabled={loading} className={btnCls}>
              {loading ? 'Chargement...' : isSignupClient ? 'Créer mon compte' : 'Se connecter'}
            </button>
            <button onClick={() => setIsSignupClient(!isSignupClient)} className="w-full text-xs text-center hover:underline" style={{ color: '#22209C' }}>
              {isSignupClient ? 'Déjà un compte ? Se connecter' : 'Pas encore de compte ? Créer un compte'}
            </button>
          </div>

          {/* ── COLONNE 2 : DÉPOSANTE ── */}
          <div className="flex flex-col px-6 py-5 space-y-2 bg-white border border-gray-200 rounded-xl shadow-sm md:border-0 md:rounded-none md:shadow-none md:border-l md:border-gray-200">
            <h2 className="text-xl font-bold uppercase" style={{ color: '#22209C' }}>
              Vendre chez Nouvelle Rive
              {isSignupDeposante && <span className="ml-2 text-xs font-normal bg-[#22209C] text-white px-2 py-0.5 rounded-full">Créer un compte</span>}
            </h2>
            <p className="text-xs text-gray-500">Je suis un·e particulier·e, je veux vendre mes affaires.</p>
            <Link href="/client/deposant/conditions" className="text-sm underline" style={{ color: '#22209C' }}>
              Découvrir nos conditions de dépôt →
            </Link>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={emailDeposante} onChange={e => setEmailDeposante(e.target.value)} required className={inputCls} placeholder="ton@email.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mot de passe</label>
              <div className="relative">
                <input type={showPasswordDeposante ? 'text' : 'password'} value={passwordDeposante} onChange={e => setPasswordDeposante(e.target.value)} required minLength={6} className={inputCls} placeholder="••••••••" />
                <button type="button" onClick={() => setShowPasswordDeposante(!showPasswordDeposante)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPasswordDeposante ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>
            <button onClick={handleDeposanteSubmit} disabled={loading} className={btnCls}>
              {loading ? 'Chargement...' : isSignupDeposante ? 'Créer mon compte' : 'Se connecter'}
            </button>
            <button onClick={() => setIsSignupDeposante(!isSignupDeposante)} className="w-full text-xs text-center hover:underline" style={{ color: '#22209C' }}>
              {isSignupDeposante ? 'Déjà un compte ? Se connecter' : 'Pas encore de compte ? Créer un compte'}
            </button>
          </div>

          {/* ── COLONNE 3 : PRO ── */}
          <div className="flex flex-col px-6 py-5 space-y-2 bg-white border border-gray-200 rounded-xl shadow-sm md:border-0 md:rounded-none md:shadow-none md:border-l md:border-gray-200">
            <h2 className="text-xl font-bold uppercase" style={{ color: '#22209C' }}>Espace professionnel·les</h2>
            <p className="text-xs text-gray-500">Je suis un·e professionnel·le, je veux rejoindre l'équipe.</p>
            <Link href="/nous-rencontrer" className="text-sm underline" style={{ color: '#22209C' }}>
              Découvrir la boutique →
            </Link>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={emailPro} onChange={e => setEmailPro(e.target.value)} required className={inputCls} placeholder="ton@email.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mot de passe</label>
              <input type="password" value={passwordPro} onChange={e => setPasswordPro(e.target.value)} required className={inputCls} placeholder="••••••••" />
            </div>
            <button onClick={handleProSubmit} disabled={loading} className={btnCls}>
              {loading ? 'Chargement...' : isSignupPro ? 'Créer mon compte' : 'Se connecter'}
            </button>
            <a href="https://www.instagram.com/nouvellerive/?hl=fr" target="_blank" rel="noopener noreferrer" className="w-full text-xs text-center hover:underline block" style={{ color: '#22209C' }}>
              Contacter Nouvelle Rive →
            </a>
          </div>

        </div>

        {/* RETOUR À LA BOUTIQUE */}
        <div className="text-center mt-4">
          <Link href="/boutique" className="text-sm text-gray-400 hover:underline">← Retour à la boutique</Link>
        </div>

      </div>
    </main>
  )
}