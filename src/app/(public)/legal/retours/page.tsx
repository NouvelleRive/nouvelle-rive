// src/app/(public)/legal/retours/page.tsx
'use client'

import Link from 'next/link'
import { useLang, t } from '@/lib/i18n'

const bleuElectrique = '#0000FF'

export default function RetoursPage() {
  const lang = useLang()

  return (
    <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} className="bg-white min-h-screen">
      <header className="px-6 py-4">
        <Link href="/boutique" className="hover:opacity-60 transition-opacity" style={{ fontSize: '11px', letterSpacing: '0.2em' }}>
          {t('← RETOUR', '← BACK', lang)}
        </Link>
      </header>

      <div className="px-6 pt-8 pb-6">
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 80px)', fontWeight: '700', letterSpacing: '-0.02em', lineHeight: '1' }}>
          {t('RETOURS & ÉCHANGES', 'RETURNS & EXCHANGES', lang)}
        </h1>
      </div>

      <div className="w-full border-t border-black" />

      <div className="max-w-2xl px-6 py-12 space-y-12">

        <section>
          <h2 style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600', marginBottom: '24px' }}>
            {t('FRANCE & UNION EUROPÉENNE', 'FRANCE & EUROPEAN UNION', lang)}
          </h2>
          <div className="space-y-4" style={{ fontSize: '14px', lineHeight: '1.7', color: '#333' }}>
            {lang === 'en' ? (
              <>
                <p>In accordance with European law, you have a <strong>14-day</strong> withdrawal period from the date of receipt of your order to return your purchase, without having to justify your decision.</p>
                <p>Return shipping costs are on us. Contact us at <a href="mailto:nouvelleriveparis@gmail.com" style={{ color: bleuElectrique }}>nouvelleriveparis@gmail.com</a> to receive a prepaid return label.</p>
                <p>Refunds will be issued within 14 days of receiving the returned item, via the same payment method used at purchase.</p>
                <p style={{ fontSize: '12px', color: '#999' }}>Items must be returned in their original condition, unworn and undamaged.</p>
              </>
            ) : (
              <>
                <p>Conformément à la législation européenne, vous disposez d&apos;un délai de <strong>14 jours</strong> à compter de la réception de votre commande pour exercer votre droit de rétractation, sans avoir à justifier votre décision.</p>
                <p>Les frais de retour sont à notre charge. Contactez-nous à <a href="mailto:nouvelleriveparis@gmail.com" style={{ color: bleuElectrique }}>nouvelleriveparis@gmail.com</a> pour obtenir une étiquette de retour.</p>
                <p>Le remboursement sera effectué dans un délai de 14 jours après réception du produit retourné, par le même moyen de paiement utilisé lors de l&apos;achat.</p>
                <p style={{ fontSize: '12px', color: '#999' }}>Les articles doivent être retournés dans leur état d&apos;origine, non portés et non endommagés.</p>
              </>
            )}
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600', marginBottom: '24px' }}>
            {t('INTERNATIONAL (ÉTATS-UNIS, ROYAUME-UNI, JAPON...)', 'INTERNATIONAL (US, UK, JAPAN...)', lang)}
          </h2>
          <div className="space-y-4" style={{ fontSize: '14px', lineHeight: '1.7', color: '#333' }}>
            {lang === 'en' ? (
              <>
                <p>Returns are accepted only in case of <strong>defective or non-conforming items</strong>.</p>
                <p>If there is an issue, contact us within <strong>7 days</strong> of receipt at <a href="mailto:nouvelleriveparis@gmail.com" style={{ color: bleuElectrique }}>nouvelleriveparis@gmail.com</a> with supporting photos.</p>
                <p>International return shipping costs are the customer&apos;s responsibility.</p>
              </>
            ) : (
              <>
                <p>Les retours sont acceptés uniquement en cas de <strong>produit défectueux ou non conforme</strong> à la description.</p>
                <p>En cas de problème, contactez-nous dans les <strong>7 jours</strong> suivant la réception à <a href="mailto:nouvelleriveparis@gmail.com" style={{ color: bleuElectrique }}>nouvelleriveparis@gmail.com</a> avec photos à l&apos;appui.</p>
                <p>Les frais de retour international sont à la charge du client.</p>
              </>
            )}
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600', marginBottom: '24px' }}>
            {t('ÉCHANGES', 'EXCHANGES', lang)}
          </h2>
          <div className="space-y-4" style={{ fontSize: '14px', lineHeight: '1.7', color: '#333' }}>
            {lang === 'en' ? (
              <>
                <p>Each Nouvelle Rive piece is one-of-a-kind. Exchanges are only possible against store credit, subject to availability.</p>
                <p>Contact us at <a href="mailto:nouvelleriveparis@gmail.com" style={{ color: bleuElectrique }}>nouvelleriveparis@gmail.com</a></p>
              </>
            ) : (
              <>
                <p>Chaque pièce Nouvelle Rive est unique. Les échanges sont possibles uniquement contre un avoir, dans la limite des stocks disponibles.</p>
                <p>Contactez-nous à <a href="mailto:nouvelleriveparis@gmail.com" style={{ color: bleuElectrique }}>nouvelleriveparis@gmail.com</a></p>
              </>
            )}
          </div>
        </section>

        <section className="pt-6 border-t border-black">
          <p style={{ fontSize: '11px', letterSpacing: '0.15em', color: '#999' }}>
            NOUVELLE RIVE — 8 RUE DES ÉCOUFFES, 75004 PARIS
          </p>
        </section>

      </div>
    </div>
  )
}
