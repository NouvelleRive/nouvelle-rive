'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart, calculerLivraison, PAYS_LIVRAISON } from '@/lib/cart'
import { useLang, t } from '@/lib/i18n'
import { formatPrix } from '@/lib/formatPrix'
import { trackCheckoutStart } from '@/lib/backstage'

type ClientInfo = {
  prenom: string
  nom: string
  email: string
  telephone: string
}

type AdresseLivraison = {
  adresse: string
  codePostal: string
  ville: string
  pays: string
  paysCode: string
}

const bleuElectrique = '#0000FF'
const cleanProductName = (nom: string) => nom.replace(/^[A-Z]+\d*\s*[-–]\s*/i, '')

function CheckoutContent() {
  const router = useRouter()
  const { items, hydrated, count, sousTotal, removeItem } = useCart()
  const lang = useLang()

  const [processing, setProcessing] = useState(false)
  const [modeLivraison, setModeLivraison] = useState<'retrait' | 'livraison'>('retrait')
  const [clientInfo, setClientInfo] = useState<ClientInfo>({ prenom: '', nom: '', email: '', telephone: '' })
  const [adresse, setAdresse] = useState<AdresseLivraison>({ adresse: '', codePostal: '', ville: '', pays: 'France', paysCode: 'FR' })

  useEffect(() => {
    const savedClientInfo = localStorage.getItem('nouvelle-rive-client')
    if (savedClientInfo) setClientInfo(JSON.parse(savedClientInfo))
    const savedAdresse = localStorage.getItem('nouvelle-rive-adresse')
    if (savedAdresse) setAdresse(JSON.parse(savedAdresse))
  }, [])

  useEffect(() => {
    if (hydrated && count === 0) router.push('/panier')
  }, [hydrated, count, router])

  // Backstage : le visiteur a atteint le tunnel de paiement avec un panier rempli.
  // Une seule fois par arrivée sur la page, même s'il retire un article ensuite.
  const checkoutTracked = useRef(false)
  useEffect(() => {
    if (hydrated && count > 0 && !checkoutTracked.current) {
      checkoutTracked.current = true
      trackCheckoutStart()
    }
  }, [hydrated, count])

  const fraisLivraison = calculerLivraison(sousTotal, modeLivraison, adresse.paysCode)
  const fraisLivraisonPreview = calculerLivraison(sousTotal, 'livraison', adresse.paysCode)
  const total = sousTotal + fraisLivraison
  const locale = lang === 'en' ? 'en-US' : 'fr-FR'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (items.length === 0) return
    setProcessing(true)
    try {
      localStorage.setItem('nouvelle-rive-client', JSON.stringify(clientInfo))
      if (modeLivraison === 'livraison') localStorage.setItem('nouvelle-rive-adresse', JSON.stringify(adresse))

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ id: i.id, nom: i.nom, prix: i.prix, imageUrl: i.imageUrl })),
          clientInfo,
          adresse: modeLivraison === 'livraison' ? adresse : null,
          modeLivraison,
          paysCode: modeLivraison === 'livraison' ? adresse.paysCode : 'FR',
        })
      })
      const data = await response.json()
      if (data.success && data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else if (data?.soldOutId) {
        removeItem(data.soldOutId)
        alert(t(
          "Un article de votre panier vient d'être vendu. Il a été retiré.",
          'An item in your cart has just been sold. It has been removed.',
          lang
        ))
        router.push('/panier')
      } else {
        alert(t('Erreur de paiement. Merci de réessayer.', 'Payment error. Please try again.', lang))
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert(t('Erreur de paiement. Merci de réessayer.', 'Payment error. Please try again.', lang))
    } finally {
      setProcessing(false)
    }
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: '11px', letterSpacing: '0.2em' }}>
          {t('CHARGEMENT...', 'LOADING...', lang)}
        </p>
      </div>
    )
  }

  if (count === 0) return null

  return (
    <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} className="bg-white min-h-screen">
      <header className="px-6 py-4 flex justify-between items-center">
        <Link href="/panier" className="hover:opacity-60 transition-opacity" style={{ fontSize: '11px', letterSpacing: '0.2em' }}>
          {t('← RETOUR AU PANIER', '← BACK TO CART', lang)}
        </Link>
        {modeLivraison === 'livraison' && fraisLivraison === 0 && (
          <p style={{ fontSize: '11px', letterSpacing: '0.02em', color: bleuElectrique }}>
            {t('Livraison offerte ✓', 'Free shipping ✓', lang)}
          </p>
        )}
      </header>
      <div className="px-6 pt-8 pb-0">
        <h1 className="pb-6" style={{ fontSize: 'clamp(28px, 4vw, 100px)', fontWeight: '700', letterSpacing: '-0.02em', lineHeight: '1' }}>
          {t('FINALISER LA COMMANDE', 'COMPLETE YOUR ORDER', lang)}
        </h1>
      </div>
      <div className="w-full border-t border-black" />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-200px)]">
          {/* Récap panier */}
          <div className="p-6 lg:p-12 lg:border-r border-black">
            <h2 className="mb-6" style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>
              {t('VOTRE COMMANDE', 'YOUR ORDER', lang)}
            </h2>

            <div className="space-y-4 mb-8">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4 pb-4 border-b border-gray-200">
                  {item.imageUrl && <img src={item.imageUrl} alt={cleanProductName(item.nom)} className="w-20 h-20 object-cover" />}
                  <div className="flex-1">
                    {item.marque && <p style={{ fontSize: '10px', letterSpacing: '0.15em', color: '#999' }}>{item.marque.toUpperCase()}</p>}
                    <p style={{ fontSize: '13px', fontWeight: '500' }}>{cleanProductName(item.nom)}</p>
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: '500' }}>{formatPrix(item.prix, { decimals: 2 })} €</p>
                </div>
              ))}
            </div>

            <div className="space-y-2 mb-4" style={{ fontSize: '14px' }}>
              <div className="flex justify-between">
                <span>{t('Sous-total', 'Subtotal', lang)}</span>
                <span>{formatPrix(sousTotal, { decimals: 2 })} €</span>
              </div>
              {modeLivraison === 'livraison' && (
                <div className="flex justify-between">
                  <span>{t('Livraison', 'Shipping', lang)}</span>
                  {fraisLivraison === 0
                    ? <span style={{ color: bleuElectrique }}>{t('Offerte', 'Free', lang)}</span>
                    : <span>{formatPrix(fraisLivraison, { decimals: 2 })} €</span>}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-black">
              <span style={{ fontSize: '11px', letterSpacing: '0.15em' }}>{t('TOTAL', 'TOTAL', lang)}</span>
              <span style={{ fontSize: '28px', fontWeight: '600' }}>{formatPrix(total, { decimals: 2 })} €</span>
            </div>
          </div>

          {/* Formulaire */}
          <div className="p-6 lg:p-12 space-y-10">
            <div>
              <h2 className="mb-6" style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>
                {t('VOS INFORMATIONS', 'YOUR DETAILS', lang)}
              </h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>
                    {t('PRÉNOM *', 'FIRST NAME *', lang)}
                  </label>
                  <input type="text" required value={clientInfo.prenom} onChange={(e) => setClientInfo({ ...clientInfo, prenom: e.target.value })} className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2" style={{ fontSize: '14px', background: 'transparent' }} />
                </div>
                <div>
                  <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>
                    {t('NOM *', 'LAST NAME *', lang)}
                  </label>
                  <input type="text" required value={clientInfo.nom} onChange={(e) => setClientInfo({ ...clientInfo, nom: e.target.value })} className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2" style={{ fontSize: '14px', background: 'transparent' }} />
                </div>
              </div>
              <div className="mb-4">
                <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>{t('EMAIL *', 'EMAIL *', lang)}</label>
                <input type="email" required value={clientInfo.email} onChange={(e) => setClientInfo({ ...clientInfo, email: e.target.value })} className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2" style={{ fontSize: '14px', background: 'transparent' }} />
              </div>
              <div>
                <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>{t('TÉLÉPHONE', 'PHONE', lang)}</label>
                <input type="tel" value={clientInfo.telephone} onChange={(e) => setClientInfo({ ...clientInfo, telephone: e.target.value })} className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2" style={{ fontSize: '14px', background: 'transparent' }} placeholder={t('Optionnel', 'Optional', lang)} />
              </div>
            </div>

            <div>
              <h2 className="mb-6" style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>
                {t('RÉCUPÉRATION', 'PICKUP / DELIVERY', lang)}
              </h2>
              <div className="flex gap-8">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="mode" value="retrait" checked={modeLivraison === 'retrait'} onChange={() => setModeLivraison('retrait')} className="w-4 h-4 accent-black" />
                  <div>
                    <p style={{ fontSize: '13px' }}>{t('Retrait en boutique', 'In-store pickup', lang)}</p>
                    <p style={{ fontSize: '11px', color: '#666' }}>{t('Gratuit', 'Free', lang)}</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="mode" value="livraison" checked={modeLivraison === 'livraison'} onChange={() => setModeLivraison('livraison')} className="w-4 h-4 accent-black" />
                  <div>
                    <p style={{ fontSize: '13px' }}>{t('Livraison à domicile', 'Home delivery', lang)}</p>
                    {fraisLivraisonPreview > 0 && (
                      <p style={{ fontSize: '11px', color: '#666' }}>
                        {t('À partir de', 'From', lang)} {fraisLivraisonPreview}€
                      </p>
                    )}
                  </div>
                </label>
              </div>
              {modeLivraison === 'retrait' && <p className="mt-4" style={{ fontSize: '12px', color: '#666' }}>8 rue des Ecouffes, 75004 Paris</p>}
            </div>

            {modeLivraison === 'livraison' && (
              <div>
                <h2 className="mb-6" style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>
                  {t('ADRESSE DE LIVRAISON', 'SHIPPING ADDRESS', lang)}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>
                      {t('ADRESSE *', 'ADDRESS *', lang)}
                    </label>
                    <input type="text" required value={adresse.adresse} onChange={(e) => setAdresse({ ...adresse, adresse: e.target.value })} className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2" style={{ fontSize: '14px', background: 'transparent' }} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>
                        {t('CODE POSTAL *', 'ZIP / POSTAL CODE *', lang)}
                      </label>
                      <input type="text" required value={adresse.codePostal} onChange={(e) => setAdresse({ ...adresse, codePostal: e.target.value })} className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2" style={{ fontSize: '14px', background: 'transparent' }} />
                    </div>
                    <div>
                      <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>
                        {t('VILLE *', 'CITY *', lang)}
                      </label>
                      <input type="text" required value={adresse.ville} onChange={(e) => setAdresse({ ...adresse, ville: e.target.value })} className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2" style={{ fontSize: '14px', background: 'transparent' }} />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>
                      {t('PAYS *', 'COUNTRY *', lang)}
                    </label>
                    <select
                      required
                      value={adresse.paysCode}
                      onChange={(e) => {
                        const code = e.target.value
                        const found = PAYS_LIVRAISON.find(p => p.code === code)
                        setAdresse({ ...adresse, paysCode: code, pays: found?.nom || code })
                      }}
                      className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2"
                      style={{ fontSize: '14px', background: 'transparent' }}
                    >
                      {PAYS_LIVRAISON.map(p => (
                        <option key={p.code} value={p.code}>{p.nom}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-6">
              <button type="submit" disabled={processing} className="w-full py-4 text-white transition-opacity hover:opacity-80 disabled:opacity-50" style={{ backgroundColor: bleuElectrique, fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>
                {processing
                  ? t('TRAITEMENT...', 'PROCESSING...', lang)
                  : `${t('PAYER', 'PAY', lang)} ${formatPrix(total, { decimals: 2 })} €`}
              </button>
              <p className="text-center mt-4" style={{ fontSize: '10px', color: '#999' }}>
                {t('Paiement 100% sécurisé', '100% secure payment', lang)}
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Chargement...</p></div>}>
      <CheckoutContent />
    </Suspense>
  )
}
