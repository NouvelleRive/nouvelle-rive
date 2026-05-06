'use client'

import Link from 'next/link'
import { useLang, t } from '@/lib/i18n'

const bleuElectrique = '#0000FF'

export default function ConfidentialitePage() {
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
          {t('CONFIDENTIALITÉ', 'PRIVACY', lang)}
        </h1>
      </div>
      <div className="w-full border-t border-black" />
      <div className="max-w-2xl px-6 py-12 space-y-12">

        <section>
          <h2 style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600', marginBottom: '24px' }}>
            {t('POLITIQUE DE CONFIDENTIALITÉ', 'PRIVACY POLICY', lang)}
          </h2>
          <div className="space-y-4" style={{ fontSize: '14px', lineHeight: '1.7', color: '#333' }}>
            {lang === 'en' ? (
              <>
                <p><strong>Data controller:</strong> NR1 SAS — 5 Route du Grand Pont, 78110 Le Vésinet, France</p>
                <p><strong>Data collected</strong><br />We only collect the data needed to process your orders: first name, last name, email, phone, shipping address.</p>
                <p><strong>Purpose</strong><br />This data is used exclusively to process and track your orders, and to contact you when needed.</p>
                <p><strong>Retention</strong><br />Your data is kept for 3 years from your last order, in accordance with French law.</p>
                <p><strong>Data sharing</strong><br />Your data is never sold to third parties. It is shared only with our payment (Square) and shipping providers, strictly to process your order.</p>
                <p><strong>Your rights</strong><br />Under the GDPR, you have rights of access, rectification, deletion and portability of your data. To exercise these rights, contact us at <a href="mailto:nouvelleriveparis@gmail.com" style={{ color: bleuElectrique }}>nouvelleriveparis@gmail.com</a>.</p>
                <p><strong>Cookies</strong><br />The site uses technical cookies necessary for its operation. No advertising cookies are placed without your consent.</p>
              </>
            ) : (
              <>
                <p><strong>Responsable du traitement :</strong> NR1 SAS — 5 Route du Grand Pont, 78110 Le Vésinet</p>
                <p><strong>Données collectées</strong><br />Nous collectons uniquement les données nécessaires au traitement de vos commandes : nom, prénom, email, téléphone, adresse de livraison.</p>
                <p><strong>Finalités</strong><br />Ces données sont utilisées exclusivement pour le traitement et le suivi de vos commandes, et pour vous contacter en cas de besoin.</p>
                <p><strong>Conservation</strong><br />Vos données sont conservées 3 ans à compter de votre dernière commande, conformément à la législation française.</p>
                <p><strong>Partage des données</strong><br />Vos données ne sont jamais vendues à des tiers. Elles sont partagées uniquement avec nos prestataires de paiement (Square) et de livraison, dans le strict cadre du traitement de votre commande.</p>
                <p><strong>Vos droits</strong><br />Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès, de rectification, de suppression et de portabilité de vos données. Pour exercer ces droits, contactez-nous à <a href="mailto:nouvelleriveparis@gmail.com" style={{ color: bleuElectrique }}>nouvelleriveparis@gmail.com</a>.</p>
                <p><strong>Cookies</strong><br />Le site utilise des cookies techniques nécessaires à son fonctionnement. Aucun cookie publicitaire n&apos;est déposé sans votre consentement.</p>
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
