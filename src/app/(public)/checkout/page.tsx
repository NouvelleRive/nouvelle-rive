'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCart, calculerLivraison, PAYS_LIVRAISON } from '@/lib/cart'

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
  pays: string       // Nom affiché (ex: "France")
  paysCode: string   // Code ISO 2 lettres (ex: "FR")
}

const bleuElectrique = '#0000FF'
const cleanProductName = (nom: string) => nom.replace(/^[A-Z]+\d*\s*[-–]\s*/i, '')

function CheckoutContent() {
  const router = useRouter()
  const { items, hydrated, count, sousTotal, removeItem } = useCart()

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

  const fraisLivraison = calculerLivraison(sousTotal, modeLivraison, adresse.paysCode)
  const fraisLivraisonPreview = calculerLivraison(sousTotal, 'livraison', adresse.paysCode)
  const total = sousTotal + fraisLivraison

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
        // Article vendu entre-temps : on le retire et on renvoie l'utilisateur au panier
        removeItem(data.soldOutId)
        alert("Un article de votre panier vient d'être vendu. Il a été retiré.")
        router.push('/panier')
      } else {
        alert('Erreur de paiement. Merci de réessayer.')
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur de paiement. Merci de réessayer.')
    } finally {
      setProcessing(false)
    }
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: '11px', letterSpacing: '0.2em' }}>CHARGEMENT...</p>
      </div>
    )
  }

  if (count === 0) return null

  return (
    <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} className="bg-white min-h-screen">
      <header className="px-6 py-4 flex justify-between items-center">
        <Link href="/panier" className="hover:opacity-60 transition-opacity" style={{ fontSize: '11px', letterSpacing: '0.2em' }}>← RETOUR AU PANIER</Link>
        {modeLivraison === 'livraison' && fraisLivraison === 0 && (
          <p style={{ fontSize: '11px', letterSpacing: '0.02em', color: bleuElectrique }}>Livraison offerte ✓</p>
        )}
      </header>
      <div className="px-6 pt-8 pb-0">
        <h1 className="pb-6" style={{ fontSize: 'clamp(28px, 4vw, 100px)', fontWeight: '700', letterSpacing: '-0.02em', lineHeight: '1' }}>
          FINALISER LA COMMANDE
        </h1>
      </div>
      <div className="w-full border-t border-black" />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-200px)]">
          {/* Récap panier */}
          <div className="p-6 lg:p-12 lg:border-r border-black">
            <h2 className="mb-6" style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>VOTRE COMMANDE</h2>

            <div className="space-y-4 mb-8">
              {items.map((item) => (
                <div key={item.id} className="flex gap-4 pb-4 border-b border-gray-200">
                  {item.imageUrl && <img src={item.imageUrl} alt={cleanProductName(item.nom)} className="w-20 h-20 object-cover" />}
                  <div className="flex-1">
                    {item.marque && <p style={{ fontSize: '10px', letterSpacing: '0.15em', color: '#999' }}>{item.marque.toUpperCase()}</p>}
                    <p style={{ fontSize: '13px', fontWeight: '500' }}>{cleanProductName(item.nom)}</p>
                  </div>
                  <p style={{ fontSize: '13px', fontWeight: '500' }}>{item.prix.toFixed(2)} €</p>
                </div>
              ))}
            </div>

            <div className="space-y-2 mb-4" style={{ fontSize: '14px' }}>
              <div className="flex justify-between">
                <span>Sous-total</span>
                <span>{sousTotal.toFixed(2)} €</span>
              </div>
              {modeLivraison === 'livraison' && (
                <div className="flex justify-between">
                  <span>Livraison</span>
                  {fraisLivraison === 0
                    ? <span style={{ color: bleuElectrique }}>Offerte</span>
                    : <span>{fraisLivraison.toFixed(2)} €</span>}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-black">
              <span style={{ fontSize: '11px', letterSpacing: '0.15em' }}>TOTAL</span>
              <span style={{ fontSize: '28px', fontWeight: '600' }}>{total.toFixed(2)} €</span>
            </div>
          </div>

          {/* Formulaire */}
          <div className="p-6 lg:p-12 space-y-10">
            <div>
              <h2 className="mb-6" style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>VOS INFORMATIONS</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>PRÉNOM *</label>
                  <input type="text" required value={clientInfo.prenom} onChange={(e) => setClientInfo({ ...clientInfo, prenom: e.target.value })} className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2" style={{ fontSize: '14px', background: 'transparent' }} />
                </div>
                <div>
                  <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>NOM *</label>
                  <input type="text" required value={clientInfo.nom} onChange={(e) => setClientInfo({ ...clientInfo, nom: e.target.value })} className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2" style={{ fontSize: '14px', background: 'transparent' }} />
                </div>
              </div>
              <div className="mb-4">
                <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>EMAIL *</label>
                <input type="email" required value={clientInfo.email} onChange={(e) => setClientInfo({ ...clientInfo, email: e.target.value })} className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2" style={{ fontSize: '14px', background: 'transparent' }} />
              </div>
              <div>
                <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>TÉLÉPHONE</label>
                <input type="tel" value={clientInfo.telephone} onChange={(e) => setClientInfo({ ...clientInfo, telephone: e.target.value })} className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2" style={{ fontSize: '14px', background: 'transparent' }} placeholder="Optionnel" />
              </div>
            </div>

            <div>
              <h2 className="mb-6" style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>RÉCUPÉRATION</h2>
              <div className="flex gap-8">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="mode" value="retrait" checked={modeLivraison === 'retrait'} onChange={() => setModeLivraison('retrait')} className="w-4 h-4 accent-black" />
                  <div>
                    <p style={{ fontSize: '13px' }}>Retrait en boutique</p>
                    <p style={{ fontSize: '11px', color: '#666' }}>Gratuit</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="mode" value="livraison" checked={modeLivraison === 'livraison'} onChange={() => setModeLivraison('livraison')} className="w-4 h-4 accent-black" />
                  <div>
                    <p style={{ fontSize: '13px' }}>Livraison à domicile</p>
                    <p style={{ fontSize: '11px', color: fraisLivraisonPreview === 0 ? bleuElectrique : '#666' }}>
                      {fraisLivraisonPreview === 0 ? 'Offerte' : `À partir de ${fraisLivraisonPreview}€`}
                    </p>
                  </div>
                </label>
              </div>
              {modeLivraison === 'retrait' && <p className="mt-4" style={{ fontSize: '12px', color: '#666' }}>8 rue des Ecouffes, 75004 Paris</p>}
            </div>

            {modeLivraison === 'livraison' && (
              <div>
                <h2 className="mb-6" style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>ADRESSE DE LIVRAISON</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>ADRESSE *</label>
                    <input type="text" required value={adresse.adresse} onChange={(e) => setAdresse({ ...adresse, adresse: e.target.value })} className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2" style={{ fontSize: '14px', background: 'transparent' }} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>CODE POSTAL *</label>
                      <input type="text" required value={adresse.codePostal} onChange={(e) => setAdresse({ ...adresse, codePostal: e.target.value })} className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2" style={{ fontSize: '14px', background: 'transparent' }} />
                    </div>
                    <div>
                      <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>VILLE *</label>
                      <input type="text" required value={adresse.ville} onChange={(e) => setAdresse({ ...adresse, ville: e.target.value })} className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2" style={{ fontSize: '14px', background: 'transparent' }} />
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>PAYS *</label>
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
                {processing ? 'TRAITEMENT...' : `PAYER ${total.toFixed(2)} €`}
              </button>
              <p className="text-center mt-4" style={{ fontSize: '10px', color: '#999' }}>Paiement sécurisé via Square</p>
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
