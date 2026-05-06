'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { doc, getDoc, collection, addDoc, Timestamp, query, where, getDocs, increment, updateDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebaseConfig'
import Link from 'next/link'
import { useCart } from '@/lib/cart'

const bleuElectrique = '#0000FF'
const cleanProductName = (nom: string) => nom.replace(/^[A-Z]+\d*\s*[-–]\s*/i, '')

const updateOrCreateClient = async (
  clientInfo: { prenom: string; nom: string; email: string; telephone: string },
  montantCommande: number
) => {
  if (!clientInfo.email) return
  const clientsRef = collection(db, 'clients')
  const q = query(clientsRef, where('email', '==', clientInfo.email.toLowerCase()))
  const snapshot = await getDocs(q)
  if (snapshot.empty) {
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
  } else {
    const clientDoc = snapshot.docs[0]
    await updateDoc(doc(db, 'clients', clientDoc.id), {
      nombreCommandes: increment(1),
      totalDepense: increment(montantCommande),
      derniereCommande: Timestamp.now(),
      prenom: clientInfo.prenom,
      nom: clientInfo.nom,
      telephone: clientInfo.telephone || clientDoc.data().telephone
    })
  }
}

function ConfirmationContent() {
  const searchParams = useSearchParams()
  const { clearCart } = useCart()

  const [loading, setLoading] = useState(true)
  const [produits, setProduits] = useState<any[]>([])

  const orderId = searchParams.get('orderId')
  const productIdsParam = searchParams.get('productIds') || searchParams.get('productId') || ''
  const isTest = searchParams.get('test') === 'true'

  useEffect(() => {
    async function handleConfirmation() {
      const ids = productIdsParam.split(',').map(s => s.trim()).filter(Boolean)
      if (ids.length === 0) { setLoading(false); return }

      try {
        const fetched: any[] = []
        for (const pid of ids) {
          const snap = await getDoc(doc(db, 'produits', pid))
          if (snap.exists()) fetched.push({ id: snap.id, ...snap.data() })
        }
        setProduits(fetched)

        if (!isTest && fetched.length > 0) {
          const dejaTraite = sessionStorage.getItem(`commande-${orderId}`)
          if (!dejaTraite) {
            const clientInfoStr = localStorage.getItem('nouvelle-rive-client')
            const clientInfo = clientInfoStr ? JSON.parse(clientInfoStr) : {}
            const totalMontant = fetched.reduce((s, p) => s + (Number(p.prix) || 0), 0)

            await updateOrCreateClient(
              {
                prenom: clientInfo.prenom || '',
                nom: clientInfo.nom || '',
                email: clientInfo.email || '',
                telephone: clientInfo.telephone || ''
              },
              totalMontant
            )
            sessionStorage.setItem(`commande-${orderId}`, 'true')
          }
          // On vide le panier dans tous les cas (le client est arrivé sur la page de confirmation)
          clearCart()
        }
      } catch (error) {
        console.error('Erreur:', error)
      } finally {
        setLoading(false)
      }
    }
    handleConfirmation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIdsParam, orderId, isTest])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: '11px', letterSpacing: '0.2em' }}>CHARGEMENT...</p>
      </div>
    )
  }

  const total = produits.reduce((s, p) => s + (Number(p.prix) || 0), 0)

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <main className="max-w-2xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h1 style={{ fontSize: 'clamp(32px, 6vw, 56px)', fontWeight: '700', letterSpacing: '-0.03em', lineHeight: '1', marginBottom: '16px' }}>
            {isTest ? 'TEST RÉUSSI' : 'COMMANDE CONFIRMÉE'}
          </h1>
          <p style={{ fontSize: '13px', color: '#666' }}>
            {isTest ? 'Le système fonctionne parfaitement.' : 'Votre paiement a été traité avec succès.'}
          </p>
        </div>

        <div className="w-full border-t border-black mb-12" />

        {produits.length > 0 && (
          <div className="mb-12">
            <p className="mb-6" style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>
              {produits.length > 1 ? `VOS ARTICLES (${produits.length})` : 'VOTRE ARTICLE'}
            </p>
            <div className="space-y-6">
              {produits.map((produit) => (
                <div key={produit.id} className="flex gap-6">
                  {produit.imageUrls?.[0] && (
                    <img src={produit.imageUrls[0]} alt={cleanProductName(produit.nom)} className="w-32 h-32 object-cover" />
                  )}
                  <div className="flex flex-col justify-center">
                    {produit.marque && (
                      <p style={{ fontSize: '10px', letterSpacing: '0.15em', color: '#999', marginBottom: '4px' }}>
                        {produit.marque.toUpperCase()}
                      </p>
                    )}
                    <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>{cleanProductName(produit.nom)}</p>
                    <p style={{ fontSize: '20px', fontWeight: '600' }}>{Number(produit.prix).toFixed(2)} €</p>
                  </div>
                </div>
              ))}
            </div>
            {produits.length > 1 && (
              <div className="flex justify-between items-center pt-6 mt-6 border-t border-black">
                <span style={{ fontSize: '11px', letterSpacing: '0.15em' }}>SOUS-TOTAL</span>
                <span style={{ fontSize: '24px', fontWeight: '600' }}>{total.toFixed(2)} €</span>
              </div>
            )}
            {orderId && <p className="mt-6" style={{ fontSize: '11px', color: '#999' }}>N° {orderId}</p>}
          </div>
        )}

        <div className="w-full border-t border-black mb-12" />

        <div className="mb-12">
          <p className="mb-6" style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>RÉCUPÉRATION</p>
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

        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/boutique"
            className="flex-1 py-4 text-white text-center transition-opacity hover:opacity-80"
            style={{ backgroundColor: bleuElectrique, fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
          >
            CONTINUER MES ACHATS
          </Link>
          <Link
            href="/"
            className="flex-1 py-4 text-center border border-black transition-colors hover:bg-black hover:text-white"
            style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
          >
            RETOUR À L'ACCUEIL
          </Link>
        </div>
      </main>

      <footer className="border-t border-black py-8 text-center">
        <p style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#999' }}>
          NOUVELLE RIVE — 8 RUE DES ECOUFFES, PARIS
        </p>
      </footer>
    </div>
  )
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Chargement...</p></div>}>
      <ConfirmationContent />
    </Suspense>
  )
}
