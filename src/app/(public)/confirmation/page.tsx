export const dynamic = 'force-dynamic'

// src/app/(public)/confirmation/page.tsx
'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { doc, updateDoc, getDoc, collection, addDoc, Timestamp, query, where, getDocs, increment } from 'firebase/firestore'
import { db, auth } from '@/lib/firebaseConfig'
import Link from 'next/link'
import PopupPromotion from '@/components/PopupPromotion'

const bleuElectrique = '#0000FF'

// Fonction pour nettoyer le SKU du nom
const cleanProductName = (nom: string) => nom.replace(/^[A-Z]+\d*\s*[-–]\s*/i, '')

// Fonction pour créer ou mettre à jour un client
const updateOrCreateClient = async (clientInfo: {
  prenom: string
  nom: string
  email: string
  telephone: string
}, montantCommande: number) => {
  if (!clientInfo.email) return
  
  const clientsRef = collection(db, 'clients')
  const q = query(clientsRef, where('email', '==', clientInfo.email.toLowerCase()))
  const snapshot = await getDocs(q)
  
  if (snapshot.empty) {
    // Nouveau client → créer
    await addDoc(clientsRef, {
      prenom: clientInfo.prenom,
      nom: clientInfo.nom,
      email: clientInfo.email.toLowerCase(),
      telephone: clientInfo.telephone || '',
      nombreCommandes: 1,
      totalDepense: montantCommande,
      premiereCommande: Timestamp.now(),
      derniereCommande: Timestamp.now(),
      createdAt: Timestamp.now()
    })
    console.log('✅ Nouveau client créé:', clientInfo.email)
  } else {
    // Client existant → mettre à jour
    const clientDoc = snapshot.docs[0]
    await updateDoc(doc(db, 'clients', clientDoc.id), {
      nombreCommandes: increment(1),
      totalDepense: increment(montantCommande),
      derniereCommande: Timestamp.now(),
      // Mettre à jour les infos au cas où elles ont changé
      prenom: clientInfo.prenom,
      nom: clientInfo.nom,
      telephone: clientInfo.telephone || clientDoc.data().telephone
    })
    console.log('✅ Client mis à jour:', clientInfo.email)
  }
}

export default function ConfirmationPage() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [produit, setProduit] = useState<any>(null)
  const [nombreAchats, setNombreAchats] = useState(0)
  const [commandeId, setCommandeId] = useState<string | null>(null)

  const orderId = searchParams.get('orderId')
  const productId = searchParams.get('productId')
  const isTest = searchParams.get('test') === 'true'

  useEffect(() => {
    async function handleConfirmation() {
      if (!productId) {
        setLoading(false)
        return
      }

      try {
        const produitRef = doc(db, 'produits', productId)
        const produitSnap = await getDoc(produitRef)

        if (produitSnap.exists()) {
          const produitData: any = { id: produitSnap.id, ...produitSnap.data() }
          setProduit(produitData)

          if (!isTest) {
            const dejaTraite = sessionStorage.getItem(`commande-${orderId}`)
            
            if (!dejaTraite) {
              await updateDoc(produitRef, {
                vendu: true,
                vendLe: Timestamp.now(),
                squareOrderId: orderId,
                quantite: 0
              })

              const clientInfoStr = localStorage.getItem('nouvelle-rive-client')
              const adresseStr = localStorage.getItem('nouvelle-rive-adresse')
              
              const clientInfo = clientInfoStr ? JSON.parse(clientInfoStr) : {}
              const adresse = adresseStr ? JSON.parse(adresseStr) : null

              const commandeData = {
                produit: produitData.nom,
                produitId: produitData.id,
                imageUrl: produitData.imageUrls?.[0] || null,
                marque: produitData.marque || null,
                prix: produitData.prix,
                client: {
                  prenom: clientInfo.prenom || '',
                  nom: clientInfo.nom || '',
                  email: clientInfo.email || '',
                  telephone: clientInfo.telephone || ''
                },
                adresse: adresse,
                squareOrderId: orderId,
                dateCommande: Timestamp.now(),
                statut: 'payée',
                modeLivraison: adresse ? 'livraison' : 'retrait',
                userId: auth.currentUser?.uid || null,
              }

              const docRef = await addDoc(collection(db, 'commandes'), commandeData)
              setCommandeId(docRef.id)

              // ✅ CRÉER OU METTRE À JOUR LE CLIENT
              await updateOrCreateClient(
                {
                  prenom: clientInfo.prenom || '',
                  nom: clientInfo.nom || '',
                  email: clientInfo.email || '',
                  telephone: clientInfo.telephone || ''
                },
                produitData.prix || 0
              )
              
              sessionStorage.setItem(`commande-${orderId}`, 'true')

              const achatsActuels = localStorage.getItem('nouvelle-rive-achats')
              const nouveauNombre = achatsActuels ? parseInt(achatsActuels) + 1 : 1
              localStorage.setItem('nouvelle-rive-achats', nouveauNombre.toString())
              setNombreAchats(nouveauNombre)
            }
          }
        }
      } catch (error) {
        console.error('Erreur:', error)
      } finally {
        setLoading(false)
      }
    }

    handleConfirmation()
  }, [productId, orderId, isTest])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p style={{ 
          fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', 
          fontSize: '11px', 
          letterSpacing: '0.2em' 
        }}>
          CHARGEMENT...
        </p>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen bg-white"
      style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
    >
      {/* Popup promotionnel */}
      {!isTest && <PopupPromotion nombreAchats={nombreAchats} />}

      <main className="max-w-2xl mx-auto px-6 py-20">
        
        {/* Titre principal */}
        <div className="text-center mb-16">
          <h1 
            style={{ 
              fontSize: 'clamp(32px, 6vw, 56px)',
              fontWeight: '700',
              letterSpacing: '-0.03em',
              lineHeight: '1',
              marginBottom: '16px'
            }}
          >
            {isTest ? 'TEST RÉUSSI' : 'COMMANDE CONFIRMÉE'}
          </h1>
          <p style={{ fontSize: '13px', color: '#666' }}>
            {isTest 
              ? 'Le système fonctionne parfaitement.'
              : 'Votre paiement a été traité avec succès.'
            }
          </p>
        </div>

        {/* Trait séparateur */}
        <div className="w-full border-t border-black mb-12" />

        {/* Détails produit */}
        {produit && (
          <div className="mb-12">
            <p 
              className="mb-6"
              style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
            >
              VOTRE ARTICLE
            </p>
            
            <div className="flex gap-6">
              {produit.imageUrls?.[0] && (
                <img 
                  src={produit.imageUrls[0]} 
                  alt={cleanProductName(produit.nom)}
                  className="w-32 h-32 object-cover"
                />
              )}
              <div className="flex flex-col justify-center">
                {produit.marque && (
                  <p style={{ fontSize: '10px', letterSpacing: '0.15em', color: '#999', marginBottom: '4px' }}>
                    {produit.marque.toUpperCase()}
                  </p>
                )}
                <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
                  {cleanProductName(produit.nom)}
                </p>
                <p style={{ fontSize: '20px', fontWeight: '600' }}>
                  {produit.prix?.toFixed(2)} €
                </p>
              </div>
            </div>

            {(commandeId || orderId) && (
              <p className="mt-6" style={{ fontSize: '11px', color: '#999' }}>
                N° {commandeId || orderId}
              </p>
            )}
          </div>
        )}

        {/* Trait séparateur */}
        <div className="w-full border-t border-black mb-12" />

        {/* Récupération */}
        <div className="mb-12">
          <p 
            className="mb-6"
            style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
          >
            RÉCUPÉRATION
          </p>
          
          <div className="space-y-4">
            <div>
              <p style={{ fontSize: '14px', fontWeight: '500' }}>Retrait en boutique</p>
              <p style={{ fontSize: '13px', color: '#666' }}>8 rue des Ecouffes, 75004 Paris</p>
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: '500' }}>Livraison</p>
              <p style={{ fontSize: '13px', color: '#666' }}>Nous vous contacterons sous 24h</p>
            </div>
          </div>
        </div>

        {/* Message fidélité */}
        {!isTest && nombreAchats > 0 && (
          <div className="mb-12 p-6 border border-black">
            <p style={{ fontSize: '11px', letterSpacing: '0.15em', textAlign: 'center' }}>
              {nombreAchats === 1 && 'PROCHAIN ACHAT : LIVRAISON OFFERTE'}
              {nombreAchats === 2 && 'PROCHAIN ACHAT : -15%'}
              {nombreAchats >= 3 && 'MERCI POUR VOTRE FIDÉLITÉ'}
            </p>
          </div>
        )}

        {/* Boutons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/boutique"
            className="flex-1 py-4 text-white text-center transition-opacity hover:opacity-80"
            style={{ 
              backgroundColor: bleuElectrique,
              fontSize: '11px',
              letterSpacing: '0.2em',
              fontWeight: '600'
            }}
          >
            CONTINUER MES ACHATS
          </Link>
          <Link
            href="/"
            className="flex-1 py-4 text-center border border-black transition-colors hover:bg-black hover:text-white"
            style={{ 
              fontSize: '11px',
              letterSpacing: '0.2em',
              fontWeight: '600'
            }}
          >
            RETOUR À L'ACCUEIL
          </Link>
        </div>
      </main>

      {/* Footer minimaliste */}
      <footer className="border-t border-black py-8 text-center">
        <p style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#999' }}>
          NOUVELLE RIVE — 8 RUE DES ECOUFFES, PARIS
        </p>
      </footer>
    </div>
  )
}