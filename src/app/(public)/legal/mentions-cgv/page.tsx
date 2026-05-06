'use client'

import Link from 'next/link'
import { useLang, t } from '@/lib/i18n'

const bleuElectrique = '#0000FF'

export default function MentionsCGVPage() {
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
          {t('MENTIONS LÉGALES & CGV', 'LEGAL NOTICE & TERMS', lang)}
        </h1>
      </div>
      <div className="w-full border-t border-black" />
      <div className="max-w-2xl px-6 py-12 space-y-12">

        <section>
          <h2 style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600', marginBottom: '24px' }}>
            {t('MENTIONS LÉGALES', 'LEGAL NOTICE', lang)}
          </h2>
          <div className="space-y-3" style={{ fontSize: '14px', lineHeight: '1.7', color: '#333' }}>
            {lang === 'en' ? (
              <>
                <p><strong>Company name:</strong> NR1 SAS</p>
                <p><strong>Legal form:</strong> Simplified Joint-Stock Company (SAS)</p>
                <p><strong>SIRET:</strong> 941 895 203 00011</p>
                <p><strong>Registered office:</strong> 5 Route du Grand Pont, 78110 Le Vésinet, France</p>
                <p><strong>Business address:</strong> 8 rue des Écouffes, 75004 Paris, France</p>
                <p><strong>Email:</strong> <a href="mailto:nouvelleriveparis@gmail.com" style={{ color: bleuElectrique }}>nouvelleriveparis@gmail.com</a></p>
                <p><strong>Host:</strong> Vercel Inc., 340 Pine Street Suite 701, San Francisco, CA 94104, USA</p>
              </>
            ) : (
              <>
                <p><strong>Raison sociale :</strong> NR1 SAS</p>
                <p><strong>Forme juridique :</strong> Société par Actions Simplifiée (SAS)</p>
                <p><strong>SIRET :</strong> 941 895 203 00011</p>
                <p><strong>Siège social :</strong> 5 Route du Grand Pont, 78110 Le Vésinet, France</p>
                <p><strong>Adresse commerciale :</strong> 8 rue des Écouffes, 75004 Paris, France</p>
                <p><strong>Email :</strong> <a href="mailto:nouvelleriveparis@gmail.com" style={{ color: bleuElectrique }}>nouvelleriveparis@gmail.com</a></p>
                <p><strong>Hébergeur :</strong> Vercel Inc., 340 Pine Street Suite 701, San Francisco, CA 94104, USA</p>
              </>
            )}
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600', marginBottom: '24px' }}>
            {t('CONDITIONS GÉNÉRALES DE VENTE', 'TERMS & CONDITIONS', lang)}
          </h2>
          <div className="space-y-4" style={{ fontSize: '14px', lineHeight: '1.7', color: '#333' }}>
            {lang === 'en' ? (
              <>
                <p><strong>1. Purpose</strong><br />These T&Cs govern the sale of vintage clothing and accessories offered on nouvellerive.eu by NR1 SAS.</p>
                <p><strong>2. Products</strong><br />Each item is unique, second-hand, sold as-is as described and photographed. Photos form part of the contract.</p>
                <p><strong>3. Pricing</strong><br />Prices are listed in euros, taxes included. NR1 SAS reserves the right to change prices at any time.</p>
                <p><strong>4. Order</strong><br />The order is confirmed after full payment via Square. A confirmation email is sent automatically.</p>
                <p><strong>5. Delivery</strong><br />Free in-store pickup (8 rue des Écouffes, 75004 Paris) or home delivery. Times and rates are stated at checkout.</p>
                <p><strong>6. Right of withdrawal</strong><br />Under European law, customers based in France and the EU have a 14-day withdrawal period. Return shipping is covered by NR1 SAS.</p>
                <p><strong>7. Intellectual property</strong><br />All site content (photos, texts, logos) is the property of NR1 SAS and may not be reproduced without authorization.</p>
                <p><strong>8. Governing law</strong><br />These T&Cs are governed by French law. Any dispute falls under the jurisdiction of French courts.</p>
              </>
            ) : (
              <>
                <p><strong>1. Objet</strong><br />Les présentes CGV régissent les ventes de vêtements et accessoires vintage proposés sur nouvellerive.eu par NR1 SAS.</p>
                <p><strong>2. Produits</strong><br />Chaque article est unique, d&apos;occasion, vendu en l&apos;état tel que décrit et photographié. Les photos sont contractuelles.</p>
                <p><strong>3. Prix</strong><br />Les prix sont indiqués en euros TTC. NR1 SAS se réserve le droit de modifier ses prix à tout moment.</p>
                <p><strong>4. Commande</strong><br />La commande est validée après paiement complet via Square. Un email de confirmation est envoyé automatiquement.</p>
                <p><strong>5. Livraison</strong><br />Retrait gratuit en boutique (8 rue des Écouffes, 75004 Paris) ou livraison à domicile. Délais et tarifs indiqués au moment de la commande.</p>
                <p><strong>6. Droit de rétractation</strong><br />Conformément à la législation européenne, les clients résidant en France et dans l&apos;UE disposent d&apos;un délai de 14 jours pour exercer leur droit de rétractation. Les frais de retour sont pris en charge par NR1 SAS.</p>
                <p><strong>7. Propriété intellectuelle</strong><br />L&apos;ensemble du contenu du site (photos, textes, logos) est la propriété de NR1 SAS et ne peut être reproduit sans autorisation.</p>
                <p><strong>8. Droit applicable</strong><br />Les présentes CGV sont soumises au droit français. Tout litige relève de la compétence des tribunaux français.</p>
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
