'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { useCart, SEUIL_LIVRAISON_OFFERTE } from '@/lib/cart'
import { useLang, t } from '@/lib/i18n'
import { formatPrix } from '@/lib/formatPrix'

const bleuElectrique = '#0000FF'
const cleanProductName = (nom: string) => nom.replace(/^[A-Z]+\d*\s*[-–]\s*/i, '')

export default function PanierPage() {
  const { items, hydrated, count, sousTotal, removeItem } = useCart()
  const [retires, setRetires] = useState<string[]>([])
  const lang = useLang()

  useEffect(() => {
    if (!hydrated || items.length === 0) return
    // Vérification one-shot au montage : si l'item est vendu/absent entre l'ajout
    // au panier et l'affichage de la page, on le retire. Le checkout re-vérifie
    // aussi côté serveur (route /api/checkout), donc pas de risque d'acheter un
    // produit vendu même si un item devient vendu pendant que l'user regarde.
    let cancelled = false
    Promise.all(
      items.map(async item => {
        try {
          const snap = await getDoc(doc(db, 'produits', item.id))
          if (cancelled) return
          if (!snap.exists()) {
            removeItem(item.id)
            setRetires(prev => (prev.includes(item.nom) ? prev : [...prev, item.nom]))
            return
          }
          const data = snap.data() as Record<string, unknown>
          if (
            data.vendu === true ||
            data.statut === 'outOfStock' ||
            (typeof data.quantite === 'number' && data.quantite <= 0)
          ) {
            removeItem(item.id)
            setRetires(prev => (prev.includes(item.nom) ? prev : [...prev, item.nom]))
          }
        } catch {
          /* silencieux — on bloquera au checkout si vraiment cassé */
        }
      }),
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, items.map(i => i.id).join(',')])

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: '11px', letterSpacing: '0.2em' }}>
          {t('CHARGEMENT...', 'LOADING...', lang)}
        </p>
      </div>
    )
  }

  if (count === 0) {
    return (
      <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} className="min-h-screen bg-white">
        <main className="max-w-2xl mx-auto px-6 py-20 text-center">
          {retires.length > 0 && (
            <div className="mb-8 p-4 border border-black text-left" style={{ fontSize: '12px', lineHeight: '1.5' }}>
              <strong>
                {lang === 'en'
                  ? `Item${retires.length > 1 ? 's' : ''} removed from cart:`
                  : `Article${retires.length > 1 ? 's' : ''} retiré${retires.length > 1 ? 's' : ''} du panier :`}
              </strong>
              <ul className="mt-2 list-disc pl-5">
                {retires.map((n, i) => <li key={i}>{cleanProductName(n)}</li>)}
              </ul>
              <p className="mt-2" style={{ color: '#666' }}>
                {lang === 'en'
                  ? `Sold in-store or online in the meantime.`
                  : `Vendu${retires.length > 1 ? 's' : ''} entre-temps en boutique ou en ligne.`}
              </p>
            </div>
          )}
          <h1 style={{ fontSize: 'clamp(32px, 6vw, 56px)', fontWeight: '700', letterSpacing: '-0.03em', lineHeight: '1', marginBottom: '16px' }}>
            {t('VOTRE PANIER EST VIDE', 'YOUR CART IS EMPTY', lang)}
          </h1>
          <p style={{ fontSize: '13px', color: '#666', marginBottom: '32px' }}>
            {t('Découvrez nos pièces uniques.', 'Discover our one-of-a-kind pieces.', lang)}
          </p>
          <Link href="/boutique" className="inline-block py-4 px-8 text-white transition-opacity hover:opacity-80" style={{ backgroundColor: bleuElectrique, fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>
            {t('EXPLORER LA BOUTIQUE', 'EXPLORE THE SHOP', lang)}
          </Link>
        </main>
      </div>
    )
  }

  const manqueLivraisonOfferte = Math.max(0, SEUIL_LIVRAISON_OFFERTE - sousTotal)
  const locale = lang === 'en' ? 'en-US' : 'fr-FR'

  return (
    <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} className="bg-white min-h-screen">
      <header className="px-6 py-4 flex justify-between items-center">
        <Link href="/boutique" className="hover:opacity-60 transition-opacity" style={{ fontSize: '11px', letterSpacing: '0.2em' }}>
          {t('← CONTINUER MES ACHATS', '← CONTINUE SHOPPING', lang)}
        </Link>
      </header>
      <div className="px-6 pt-8 pb-0">
        <h1 className="pb-6" style={{ fontSize: 'clamp(28px, 4vw, 100px)', fontWeight: '700', letterSpacing: '-0.02em', lineHeight: '1' }}>
          {t('VOTRE PANIER', 'YOUR CART', lang)} ({count})
        </h1>
      </div>
      {retires.length > 0 && (
        <div className="px-6 pb-4">
          <div className="p-4 border border-black" style={{ fontSize: '12px', lineHeight: '1.5' }}>
            <strong>
              {lang === 'en'
                ? `Item${retires.length > 1 ? 's' : ''} removed:`
                : `Article${retires.length > 1 ? 's' : ''} retiré${retires.length > 1 ? 's' : ''} :`}
            </strong>{' '}
            {retires.map(cleanProductName).join(', ')}
            {' — '}
            {lang === 'en'
              ? `sold in the meantime.`
              : `vendu${retires.length > 1 ? 's' : ''} entre-temps.`}
          </div>
        </div>
      )}
      <div className="w-full border-t border-black" />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px]">
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
                  <p style={{ fontSize: '14px', fontWeight: '600' }}>{formatPrix(item.prix, { decimals: 2 })} €</p>
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="self-start hover:opacity-60 transition-opacity"
                  style={{ fontSize: '10px', letterSpacing: '0.15em', textDecoration: 'underline', color: '#666' }}
                >
                  {t('RETIRER', 'REMOVE', lang)}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 lg:p-12 space-y-6">
          <h2 style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}>
            {t('RÉSUMÉ', 'SUMMARY', lang)}
          </h2>

          <div className="space-y-2" style={{ fontSize: '14px' }}>
            <div className="flex justify-between">
              <span>
                {lang === 'en'
                  ? `Subtotal (${count} item${count > 1 ? 's' : ''})`
                  : `Sous-total (${count} article${count > 1 ? 's' : ''})`}
              </span>
              <span>{formatPrix(sousTotal, { decimals: 2 })} €</span>
            </div>
            <div className="flex justify-between" style={{ color: '#666', fontSize: '12px' }}>
              <span>{t('Livraison', 'Shipping', lang)}</span>
              <span>{t('Calculée à l\'étape suivante', 'Calculated at next step', lang)}</span>
            </div>
          </div>

          {manqueLivraisonOfferte > 0 && (
            <div className="p-4 border border-black" style={{ fontSize: '12px', lineHeight: '1.5' }}>
              {lang === 'en' ? (
                <>
                  Just <strong style={{ color: bleuElectrique }}>{formatPrix(manqueLivraisonOfferte, { decimals: 2 })} €</strong> more to unlock <strong>free shipping</strong>.
                </>
              ) : (
                <>
                  Plus que <strong style={{ color: bleuElectrique }}>{formatPrix(manqueLivraisonOfferte, { decimals: 2 })} €</strong> pour bénéficier de la <strong>livraison offerte</strong>.
                </>
              )}
            </div>
          )}
          {manqueLivraisonOfferte === 0 && (
            <div className="p-4 border border-black" style={{ fontSize: '12px', color: bleuElectrique }}>
              {t('✓ Livraison offerte', '✓ Free shipping', lang)}
            </div>
          )}

          <div className="flex justify-between items-center pt-4 border-t border-black">
            <span style={{ fontSize: '11px', letterSpacing: '0.15em' }}>
              {t('SOUS-TOTAL', 'SUBTOTAL', lang)}
            </span>
            <span style={{ fontSize: '24px', fontWeight: '600' }}>
              {formatPrix(sousTotal, { decimals: 2 })} €
            </span>
          </div>

          <Link
            href="/checkout"
            className="block w-full py-4 text-center text-white transition-opacity hover:opacity-80"
            style={{ backgroundColor: bleuElectrique, fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
          >
            {t('COMMANDER', 'CHECKOUT', lang)}
          </Link>

          <p className="text-center" style={{ fontSize: '10px', color: '#999' }}>
            {t('Paiement 100% sécurisé', '100% secure payment', lang)}
          </p>
        </div>
      </div>
    </div>
  )
}
