'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { useCart, SEUIL_LIVRAISON_OFFERTE } from '@/lib/cart'

const bleuElectrique = '#0000FF'
const cleanProductName = (nom: string) => nom.replace(/^[A-Z]+\d*\s*[-–]\s*/i, '')

export default function PanierPage() {
  const { items, hydrated, count, sousTotal, removeItem } = useCart()
  const [retires, setRetires] = useState<string[]>([])

  // Synchro temps réel : si un article devient vendu (caisse boutique p.ex.), on le retire du panier
  useEffect(() => {
    if (!hydrated || items.length === 0) return
    const unsubs = items.map(item =>
      onSnapshot(doc(db, 'produits', item.id), (snap) => {
        if (!snap.exists()) {
          removeItem(item.id)
          setRetires(prev => prev.includes(item.nom) ? prev : [...prev, item.nom])
          return
        }
        const data = snap.data() as any
        if (data.vendu === true || data.statut === 'outOfStock' || (typeof data.quantite === 'number' && data.quantite <= 0)) {
          removeItem(item.id)
          setRetires(prev => prev.includes(item.nom) ? prev : [...prev, item.nom])
        }
      })
    )
    return () => { unsubs.forEach(u => u()) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, items.map(i => i.id).join(',')])

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: '11px', letterSpacing: '0.2em' }}>CHARGEMENT...</p>
      </div>
    )
  }

  if (count === 0) {
    return (
      <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} className="min-h-screen bg-white">
        <main className="max-w-2xl mx-auto px-6 py-20 text-center">
          {retires.length > 0 && (
            <div className="mb-8 p-4 border border-black text-left" style={{ fontSize: '12px', lineHeight: '1.5' }}>
              <strong>Article{retires.length > 1 ? 's' : ''} retiré{retires.length > 1 ? 's' : ''} du panier :</strong>
              <ul className="mt-2 list-disc pl-5">
                {retires.map((n, i) => <li key={i}>{cleanProductName(n)}</li>)}
              </ul>
              <p className="mt-2" style={{ color: '#666' }}>Vendu{retires.length > 1 ? 's' : ''} entre-temps en boutique ou en ligne.</p>
            </div>
          )}
          <h1 style={{ fontSize: 'clamp(32px, 6vw, 56px)', fontWeight: '700', letterSpacing: '-0.03em', lineHeight: '1', marginBottom: '16px' }}>VOTRE PANIER EST VIDE</h1>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '32px' }}>Découvrez nos pièces uniques.</p>
          <Link href="/boutique" className="inline-block py-4 px-8 text-white transition-opacity hover:opacity-80" style={{ backgroundColor: bleuElectrique, fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>
            EXPLORER LA BOUTIQUE
          </Link>
        </main>
      </div>
    )
  }

  const manqueLivraisonOfferte = Math.max(0, SEUIL_LIVRAISON_OFFERTE - sousTotal)

  return (
    <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} className="bg-white min-h-screen">
      <header className="px-6 py-4 flex justify-between items-center">
        <Link href="/boutique" className="hover:opacity-60 transition-opacity" style={{ fontSize: '11px', letterSpacing: '0.2em' }}>← CONTINUER MES ACHATS</Link>
      </header>
      <div className="px-6 pt-8 pb-0">
        <h1 className="pb-6" style={{ fontSize: 'clamp(28px, 4vw, 100px)', fontWeight: '700', letterSpacing: '-0.02em', lineHeight: '1' }}>
          VOTRE PANIER ({count})
        </h1>
      </div>
      {retires.length > 0 && (
        <div className="px-6 pb-4">
          <div className="p-4 border border-black" style={{ fontSize: '12px', lineHeight: '1.5' }}>
            <strong>Article{retires.length > 1 ? 's' : ''} retiré{retires.length > 1 ? 's' : ''} :</strong>{' '}
            {retires.map(cleanProductName).join(', ')} — vendu{retires.length > 1 ? 's' : ''} entre-temps.
          </div>
        </div>
      )}
      <div className="w-full border-t border-black" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px]">
        {/* Liste des articles */}
        <div className="p-6 lg:p-12 lg:border-r border-black">
          {items.map((item) => (
            <div key={item.id} className="flex gap-6 py-6 border-b border-black last:border-b-0">
              {item.imageUrl && (
                <img src={item.imageUrl} alt={cleanProductName(item.nom)} className="w-32 h-32 object-cover" />
              )}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  {item.marque && (
                    <p style={{ fontSize: '10px', letterSpacing: '0.15em', color: '#999', marginBottom: '4px' }}>
                      {item.marque.toUpperCase()}
                    </p>
                  )}
                  <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>{cleanProductName(item.nom)}</p>
                  <p style={{ fontSize: '14px', fontWeight: '600' }}>{item.prix.toFixed(2)} €</p>
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="self-start hover:opacity-60 transition-opacity"
                  style={{ fontSize: '10px', letterSpacing: '0.15em', textDecoration: 'underline', color: '#666' }}
                >
                  RETIRER
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Résumé */}
        <div className="p-6 lg:p-12 space-y-6">
          <h2 style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>RÉSUMÉ</h2>

          <div className="space-y-2" style={{ fontSize: '14px' }}>
            <div className="flex justify-between">
              <span>Sous-total ({count} article{count > 1 ? 's' : ''})</span>
              <span>{sousTotal.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between" style={{ color: '#666', fontSize: '12px' }}>
              <span>Livraison</span>
              <span>Calculée à l'étape suivante</span>
            </div>
          </div>

          {manqueLivraisonOfferte > 0 && (
            <div className="p-4 border border-black" style={{ fontSize: '12px', lineHeight: '1.5' }}>
              Plus que <strong style={{ color: bleuElectrique }}>{manqueLivraisonOfferte.toFixed(2)} €</strong> pour bénéficier de la <strong>livraison offerte</strong>.
            </div>
          )}
          {manqueLivraisonOfferte === 0 && (
            <div className="p-4 border border-black" style={{ fontSize: '12px', color: bleuElectrique }}>
              ✓ Livraison offerte
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-black">
            <span style={{ fontSize: '11px', letterSpacing: '0.15em' }}>SOUS-TOTAL</span>
            <span style={{ fontSize: '24px', fontWeight: '600' }}>{sousTotal.toFixed(2)} €</span>
          </div>

          <Link
            href="/checkout"
            className="block w-full py-4 text-center text-white transition-opacity hover:opacity-80"
            style={{ backgroundColor: bleuElectrique, fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
          >
            COMMANDER
          </Link>

          <p className="text-center" style={{ fontSize: '10px', color: '#999' }}>Paiement sécurisé via Square</p>
        </div>
      </div>
    </div>
  )
}
