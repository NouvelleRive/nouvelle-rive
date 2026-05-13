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
import { useLang, t } from '@/lib/i18n'

// Détection des navigateurs in-app (WhatsApp, Instagram, Facebook, etc.)
// qui cassent Firebase Auth à cause de sessionStorage partitionné
function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /FBAN|FBAV|Instagram|WhatsApp|Line\/|Twitter|TikTok|Snapchat|LinkedInApp/i.test(ua)
}

export default function LoginPage() {
  const router = useRouter()
  const lang = useLang()
  const [loadingClient, setLoadingClient] = useState(false)
  const [loadingDeposante, setLoadingDeposante] = useState(false)
  const [loadingPro, setLoadingPro] = useState(false)
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

  const errEmailUsed = t('Email déjà utilisé', 'Email already in use', lang)
  const errWrongPassword = t('Mot de passe incorrect', 'Incorrect password', lang)
  const errNoAccount = t('Aucun compte avec cet email', 'No account with this email', lang)
  const errLogin = t('Erreur de connexion', 'Login error', lang)

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoadingClient(true)
    try {
      if (isSignupClient) await createUserWithEmailAndPassword(auth, emailClient, passwordClient)
      else await signInWithEmailAndPassword(auth, emailClient, passwordClient)
      router.push('/client')
    } catch (err: any) {
      setError(err.code === 'auth/email-already-in-use' ? errEmailUsed : err.code === 'auth/wrong-password' ? errWrongPassword : err.code === 'auth/user-not-found' ? errNoAccount : errLogin)
    } finally { setLoadingClient(false) }
  }

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
      router.push('/client')
    } catch { setError(t('Erreur Google', 'Google error', lang)) }
  }

  const handleForgotPassword = async (email: string) => {
    if (!email) { setError(t("Entre ton email d'abord", 'Enter your email first', lang)); return }
    try {
      await sendPasswordResetEmail(auth, email)
      setError(t('Email de réinitialisation envoyé !', 'Reset email sent!', lang))
    } catch { setError(t('Erreur, vérifie ton email', 'Error, please check your email', lang)) }
  }

  const handleDeposanteSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoadingDeposante(true)
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
      if (err.code === 'auth/email-already-in-use') setError(errEmailUsed)
      else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') setError(errWrongPassword)
      else if (err.code === 'auth/user-not-found') setError(errNoAccount)
      else setError(errLogin)
    } finally { setLoadingDeposante(false) }
  }

  const handleProSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoadingPro(true)
    try {
      if (isSignupPro) await createUserWithEmailAndPassword(auth, emailPro, passwordPro)
      else await signInWithEmailAndPassword(auth, emailPro, passwordPro)
      router.push('/app')
    } catch {
      setError(errLogin)
    } finally { setLoadingPro(false) }
  }

  const inputCls = "w-full border border-gray-200 px-4 py-1.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22209C]/20 focus:border-[#22209C] transition text-sm"
  const btnCls = "w-full bg-[#22209C] text-white py-1.5 rounded-lg hover:bg-[#1a1875] disabled:opacity-50 transition font-medium text-sm"

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-white to-gray-50 px-4 py-12">
      <div className="w-full max-w-5xl">

        {inApp && (
          <div className="mb-4 bg-amber-50 border border-amber-300 text-amber-800 text-sm p-4 rounded-lg">
            <p className="font-semibold mb-1">
              {t('⚠️ Ouvre cette page dans Safari ou Chrome', '⚠️ Open this page in Safari or Chrome', lang)}
            </p>
            {lang === 'en' ? (
              <p className="text-xs">
                Login does not work in the WhatsApp/Instagram/Facebook in-app browser.
                Tap the <strong>••• at the top-right</strong> then <strong>&laquo; Open in browser &raquo;</strong>.
              </p>
            ) : (
              <p className="text-xs">
                La connexion ne fonctionne pas dans le navigateur de WhatsApp/Instagram/Facebook.
                Appuie sur les <strong>••• en haut à droite</strong> puis <strong>« Ouvrir dans le navigateur »</strong>.
              </p>
            )}
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
              {t('Mon compte client', 'My customer account', lang)}
              {isSignupClient && <span className="ml-2 text-xs font-normal bg-[#22209C] text-white px-2 py-0.5 rounded-full">{t('Créer un compte', 'Create an account', lang)}</span>}
            </h2>
            <p className="text-xs text-gray-500">
              {t(
                "Je veux revoir les pépites que j'ai achetées & paramétrer mes alertes.",
                'I want to revisit my finds & set up my alerts.',
                lang
              )}
            </p>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loadingClient}
              className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 bg-white text-gray-700 py-1.5 rounded-lg hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition font-medium text-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {t('Continuer avec Google', 'Continue with Google', lang)}
            </button>
            {isSignupClient && (
              <div className="grid grid-cols-2 gap-2">
                <input value={prenomClient} onChange={e => setPrenomClient(e.target.value)} placeholder={t('Prénom', 'First name', lang)} className={inputCls} />
                <input value={nomClient} onChange={e => setNomClient(e.target.value)} placeholder={t('Nom', 'Last name', lang)} className={inputCls} />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={emailClient} onChange={e => setEmailClient(e.target.value)} required className={inputCls} placeholder={t('ton@email.com', 'your@email.com', lang)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('Mot de passe', 'Password', lang)}</label>
              <input type="password" value={passwordClient} onChange={e => setPasswordClient(e.target.value)} required minLength={6} className={inputCls} placeholder="••••••••" />
              {!isSignupClient && (
                <button type="button" onClick={() => handleForgotPassword(emailClient)} className="text-xs text-gray-400 hover:underline mt-1 block">
                  {t('Mot de passe oublié ?', 'Forgot password?', lang)}
                </button>
              )}
            </div>
            <button onClick={handleClientSubmit} disabled={loadingClient} className={btnCls}>
              {loadingClient
                ? t('Chargement...', 'Loading...', lang)
                : isSignupClient
                  ? t('Créer mon compte', 'Create my account', lang)
                  : t('Se connecter', 'Log in', lang)}
            </button>
            <button onClick={() => setIsSignupClient(!isSignupClient)} className="w-full text-xs text-center hover:underline" style={{ color: '#22209C' }}>
              {isSignupClient
                ? t('Déjà un compte ? Se connecter', 'Already have an account? Log in', lang)
                : t('Pas encore de compte ? Créer un compte', 'No account yet? Create one', lang)}
            </button>
          </div>

          {/* ── COLONNE 2 : DÉPOSANTE ── */}
          <div className="flex flex-col px-6 py-5 space-y-2 bg-white border border-gray-200 rounded-xl shadow-sm md:border-0 md:rounded-none md:shadow-none md:border-l md:border-gray-200">
            <h2 className="text-xl font-bold uppercase" style={{ color: '#22209C' }}>
              {t('Vendre chez Nouvelle Rive', 'Sell at Nouvelle Rive', lang)}
              {isSignupDeposante && <span className="ml-2 text-xs font-normal bg-[#22209C] text-white px-2 py-0.5 rounded-full">{t('Créer un compte', 'Create an account', lang)}</span>}
            </h2>
            <p className="text-xs text-gray-500">
              {t('Je suis un·e particulier·e, je veux vendre mes affaires.', 'I am an individual seller and want to sell my pieces.', lang)}
            </p>
            <Link href="/client/deposant/conditions" className="text-sm underline" style={{ color: '#22209C' }}>
              {t('Découvrir nos conditions de dépôt →', 'See our consignment terms →', lang)}
            </Link>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={emailDeposante} onChange={e => setEmailDeposante(e.target.value)} required className={inputCls} placeholder={t('ton@email.com', 'your@email.com', lang)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('Mot de passe', 'Password', lang)}</label>
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
            <button onClick={handleDeposanteSubmit} disabled={loadingDeposante} className={btnCls}>
              {loadingDeposante
                ? t('Chargement...', 'Loading...', lang)
                : isSignupDeposante
                  ? t('Créer mon compte', 'Create my account', lang)
                  : t('Se connecter', 'Log in', lang)}
            </button>
            <button onClick={() => setIsSignupDeposante(!isSignupDeposante)} className="w-full text-xs text-center hover:underline" style={{ color: '#22209C' }}>
              {isSignupDeposante
                ? t('Déjà un compte ? Se connecter', 'Already have an account? Log in', lang)
                : t('Pas encore de compte ? Créer un compte', 'No account yet? Create one', lang)}
            </button>
          </div>

          {/* ── COLONNE 3 : PRO ── */}
          <div className="flex flex-col px-6 py-5 space-y-2 bg-white border border-gray-200 rounded-xl shadow-sm md:border-0 md:rounded-none md:shadow-none md:border-l md:border-gray-200">
            <h2 className="text-xl font-bold uppercase" style={{ color: '#22209C' }}>{t('Espace professionnel·les', 'For professionals', lang)}</h2>
            <p className="text-xs text-gray-500">
              {t("Je suis un·e professionnel·le, je veux rejoindre l'équipe.", 'I am a professional and want to join the team.', lang)}
            </p>
            <Link href="/nous-rencontrer" className="text-sm underline" style={{ color: '#22209C' }}>
              {t('Découvrir la boutique →', 'Discover the shop →', lang)}
            </Link>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={emailPro} onChange={e => setEmailPro(e.target.value)} required className={inputCls} placeholder={t('ton@email.com', 'your@email.com', lang)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">{t('Mot de passe', 'Password', lang)}</label>
              <input type="password" value={passwordPro} onChange={e => setPasswordPro(e.target.value)} required className={inputCls} placeholder="••••••••" />
            </div>
            <button onClick={handleProSubmit} disabled={loadingPro} className={btnCls}>
              {loadingPro
                ? t('Chargement...', 'Loading...', lang)
                : isSignupPro
                  ? t('Créer mon compte', 'Create my account', lang)
                  : t('Se connecter', 'Log in', lang)}
            </button>
            <a href="https://www.instagram.com/nouvellerive/?hl=fr" target="_blank" rel="noopener noreferrer" className="w-full text-xs text-center hover:underline block" style={{ color: '#22209C' }}>
              {t('Contacter Nouvelle Rive →', 'Contact Nouvelle Rive →', lang)}
            </a>
          </div>

        </div>

        {/* RETOUR À LA BOUTIQUE */}
        <div className="text-center mt-4">
          <Link href="/boutique" className="text-sm text-gray-400 hover:underline">
            {t('← Retour à la boutique', '← Back to shop', lang)}
          </Link>
        </div>

      </div>
    </main>
  )
}