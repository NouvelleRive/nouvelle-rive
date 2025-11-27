'use client'

export const dynamic = 'force-dynamic'


import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import Link from 'next/link'

type Produit = {
  id: string
  nom: string
  prix: number
  imageUrls: string[]
  marque?: string
  vendu: boolean
}

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
}

const bleuElectrique = '#0000FF'

// Fonction pour nettoyer le SKU du nom du produit
const cleanProductName = (nom: string) => nom.replace(/^[A-Z]+\d+\s*[-–]\s*/i, '')

export default function CheckoutPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const productId = searchParams.get('productId')

  const [produit, setProduit] = useState<Produit | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  const [modeLivraison, setModeLivraison] = useState<'retrait' | 'livraison'>('retrait')

  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    prenom: '',
    nom: '',
    email: '',
    telephone: ''
  })

  const [adresse, setAdresse] = useState<AdresseLivraison>({
    adresse: '',
    codePostal: '',
    ville: '',
    pays: 'France'
  })

  const [nombreAchats, setNombreAchats] = useState(0)

  useEffect(() => {
    const savedClientInfo = localStorage.getItem('nouvelle-rive-client')
    if (savedClientInfo) {
      setClientInfo(JSON.parse(savedClientInfo))
    }

    const savedAdresse = localStorage.getItem('nouvelle-rive-adresse')
    if (savedAdresse) {
      setAdresse(JSON.parse(savedAdresse))
    }

    const achats = localStorage.getItem('nouvelle-rive-achats')
    setNombreAchats(achats ? parseInt(achats) : 0)

    async function fetchProduit() {
      if (!productId) {
        setLoading(false)
        return
      }

      try {
        const docRef = doc(db, 'produits', productId)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          setProduit({ id: docSnap.id, ...docSnap.data() } as Produit)
        }
      } catch (error) {
        console.error('Erreur:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProduit()
  }, [productId])

  const calculerPrixTotal = () => {
    if (!produit) return 0

    let prixProduit = produit.prix
    let fraisLivraison = 0

    if (modeLivraison === 'livraison' && nombreAchats < 1) {
      fraisLivraison = 15
    }

    if (nombreAchats >= 2) {
      prixProduit = prixProduit * 0.85
    }

    return prixProduit + fraisLivraison
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!produit) return

    setProcessing(true)

    try {
      localStorage.setItem('nouvelle-rive-client', JSON.stringify(clientInfo))
      if (modeLivraison === 'livraison') {
        localStorage.setItem('nouvelle-rive-adresse', JSON.stringify(adresse))
      }

      const prixTotal = calculerPrixTotal()

      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: produit.id,
          productName: cleanProductName(produit.nom),  // ← Nettoyé ici pour Square
          price: prixTotal,
          imageUrl: produit.imageUrls?.[0],
          clientInfo,
          adresse: modeLivraison === 'livraison' ? adresse : null,
          modeLivraison,
          nombreAchats
        })
      })

      const data = await response.json()

      if (data.success && data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        alert('Erreur lors de la création du paiement')
      }
    } catch (error) {
      console.error('Erreur:', error)
      alert('Une erreur est survenue')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: '11px', letterSpacing: '0.2em' }}>
          CHARGEMENT...
        </p>
      </div>
    )
  }

  if (!produit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: '11px', letterSpacing: '0.2em' }} className="mb-4">
            PRODUIT INTROUVABLE
          </p>
          <Link href="/boutique" className="hover:underline" style={{ color: bleuElectrique, fontSize: '11px', letterSpacing: '0.2em' }}>
            ← RETOUR À LA BOUTIQUE
          </Link>
        </div>
      </div>
    )
  }

  const prixTotal = calculerPrixTotal()
  const remise = nombreAchats >= 2 ? produit.prix * 0.15 : 0
  const fraisLivraison = modeLivraison === 'livraison' && nombreAchats < 1 ? 15 : 0

  return (
    <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} className="bg-white min-h-screen">
      
      {/* Header */}
      <header className="px-6 py-4 flex justify-between items-center">
        <Link 
          href="/boutique" 
          className="hover:opacity-60 transition-opacity"
          style={{ fontSize: '11px', letterSpacing: '0.2em' }}
        >
          ← RETOUR
        </Link>

        {/* Message promo en haut à droite */}
        {nombreAchats === 1 && (
          <p 
            className="text-right max-w-sm"
            style={{ fontSize: '20px', letterSpacing: '0.02em', color: bleuElectrique }}
          >
            C'est votre deuxième achat ! Nous vous offrons donc la livraison — <span className="font-semibold">-15% SUR LE 3E ARTICLE</span>
          </p>
        )}

        {nombreAchats >= 2 && (
          <p 
            className="text-right"
            style={{ fontSize: '11px', letterSpacing: '0.02em', color: bleuElectrique }}
          >
            -15% appliqué sur cet article
          </p>
        )}
      </header>

      {/* Titre + trait */}
      <div className="px-6 pt-8 pb-0">
        <h1 
          className="pb-6"
          style={{ 
            fontSize: 'clamp(28px, 4vw, 100px)',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            lineHeight: '1'
          }}
        >
          SOON TO BE YOURS
        </h1>
      </div>
      
      {/* Trait qui traverse toute la page */}
      <div className="w-full border-t border-black" />

      {/* Contenu 50/50 */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-200px)]">
          
          {/* GAUCHE - Produit */}
          <div className="p-6 lg:p-12 lg:border-r border-black">
            
            {/* Image produit */}
            <div className="mb-8">
              {produit.imageUrls?.[0] && (
                <img
                  src={produit.imageUrls[0]}
                  alt={cleanProductName(produit.nom)}
                  className="w-full max-w-md h-auto object-cover"
                />
              )}
            </div>

            {/* Infos produit */}
            <div className="mb-8">
              {produit.marque && (
                <p style={{ fontSize: '10px', letterSpacing: '0.15em', color: '#999', marginBottom: '8px' }}>
                  {produit.marque.toUpperCase()}
                </p>
              )}
              <p style={{ fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>
                {cleanProductName(produit.nom)}
              </p>
            </div>

            {/* Prix */}
            <div className="space-y-2 mb-8" style={{ fontSize: '14px' }}>
              <div className="flex justify-between">
                <span>Article</span>
                <span>{produit.prix.toFixed(2)} €</span>
              </div>

              {remise > 0 && (
                <div className="flex justify-between" style={{ color: bleuElectrique }}>
                  <span>Remise -15%</span>
                  <span>-{remise.toFixed(2)} €</span>
                </div>
              )}

              {modeLivraison === 'livraison' && (
                <div className="flex justify-between">
                  <span>Livraison</span>
                  {nombreAchats >= 1 ? (
                    <span style={{ color: bleuElectrique }}>Offerte</span>
                  ) : (
                    <span>{fraisLivraison.toFixed(2)} €</span>
                  )}
                </div>
              )}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center pt-4 border-t border-black">
              <span style={{ fontSize: '11px', letterSpacing: '0.15em' }}>TOTAL</span>
              <span style={{ fontSize: '28px', fontWeight: '600' }}>{prixTotal.toFixed(2)} €</span>
            </div>
          </div>

          {/* DROITE - Formulaire */}
          <div className="p-6 lg:p-12 space-y-10">
            
            {/* Informations client */}
            <div>
              <h2 
                className="mb-6"
                style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
              >
                VOS INFORMATIONS
              </h2>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>
                    PRÉNOM *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientInfo.prenom}
                    onChange={(e) => setClientInfo({ ...clientInfo, prenom: e.target.value })}
                    className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2"
                    style={{ fontSize: '14px', background: 'transparent' }}
                  />
                </div>
                <div>
                  <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>
                    NOM *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientInfo.nom}
                    onChange={(e) => setClientInfo({ ...clientInfo, nom: e.target.value })}
                    className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2"
                    style={{ fontSize: '14px', background: 'transparent' }}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>
                  EMAIL *
                </label>
                <input
                  type="email"
                  required
                  value={clientInfo.email}
                  onChange={(e) => setClientInfo({ ...clientInfo, email: e.target.value })}
                  className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2"
                  style={{ fontSize: '14px', background: 'transparent' }}
                />
              </div>

              <div>
                <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>
                  TÉLÉPHONE
                </label>
                <input
                  type="tel"
                  value={clientInfo.telephone}
                  onChange={(e) => setClientInfo({ ...clientInfo, telephone: e.target.value })}
                  className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2"
                  style={{ fontSize: '14px', background: 'transparent' }}
                  placeholder="Optionnel"
                />
              </div>
            </div>

            {/* Mode de récupération */}
            <div>
              <h2 
                className="mb-6"
                style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
              >
                RÉCUPÉRATION
              </h2>

              <div className="flex gap-8">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="retrait"
                    checked={modeLivraison === 'retrait'}
                    onChange={() => setModeLivraison('retrait')}
                    className="w-4 h-4 accent-black"
                  />
                  <div>
                    <p style={{ fontSize: '13px' }}>Retrait en boutique</p>
                    <p style={{ fontSize: '11px', color: '#666' }}>Gratuit</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="mode"
                    value="livraison"
                    checked={modeLivraison === 'livraison'}
                    onChange={() => setModeLivraison('livraison')}
                    className="w-4 h-4 accent-black"
                  />
                  <div>
                    <p style={{ fontSize: '13px' }}>Livraison à domicile</p>
                    <p style={{ fontSize: '11px', color: nombreAchats >= 1 ? bleuElectrique : '#666' }}>
                      {nombreAchats >= 1 ? 'Offerte' : '15€'}
                    </p>
                  </div>
                </label>
              </div>

              {modeLivraison === 'retrait' && (
                <p className="mt-4" style={{ fontSize: '12px', color: '#666' }}>
                  8 rue des Ecouffes, 75004 Paris
                </p>
              )}
            </div>

            {/* Adresse de livraison */}
            {modeLivraison === 'livraison' && (
              <div>
                <h2 
                  className="mb-6"
                  style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
                >
                  ADRESSE DE LIVRAISON
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>
                      ADRESSE *
                    </label>
                    <input
                      type="text"
                      required
                      value={adresse.adresse}
                      onChange={(e) => setAdresse({ ...adresse, adresse: e.target.value })}
                      className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2"
                      style={{ fontSize: '14px', background: 'transparent' }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>
                        CODE POSTAL *
                      </label>
                      <input
                        type="text"
                        required
                        value={adresse.codePostal}
                        onChange={(e) => setAdresse({ ...adresse, codePostal: e.target.value })}
                        className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2"
                        style={{ fontSize: '14px', background: 'transparent' }}
                      />
                    </div>
                    <div>
                      <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>
                        VILLE *
                      </label>
                      <input
                        type="text"
                        required
                        value={adresse.ville}
                        onChange={(e) => setAdresse({ ...adresse, ville: e.target.value })}
                        className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2"
                        style={{ fontSize: '14px', background: 'transparent' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block mb-2" style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#666' }}>
                      PAYS *
                    </label>
                    <input
                      type="text"
                      required
                      value={adresse.pays}
                      onChange={(e) => setAdresse({ ...adresse, pays: e.target.value })}
                      className="w-full px-0 py-3 border-0 border-b border-black focus:outline-none focus:border-b-2"
                      style={{ fontSize: '14px', background: 'transparent' }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bouton payer */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={processing}
                className="w-full py-4 text-white transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ 
                  backgroundColor: bleuElectrique,
                  fontSize: '11px',
                  letterSpacing: '0.2em',
                  fontWeight: '600'
                }}
              >
                {processing ? 'TRAITEMENT...' : 'PAYER'}
              </button>

              <p className="text-center mt-4" style={{ fontSize: '10px', color: '#999' }}>
                Paiement sécurisé via Square
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}