// src/app/(public)/legal/retours/page.tsx
import Link from 'next/link'

const bleuElectrique = '#0000FF'

export default function RetoursPage() {
  return (
    <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} className="bg-white min-h-screen">
      <header className="px-6 py-4">
        <Link href="/boutique" className="hover:opacity-60 transition-opacity" style={{ fontSize: '11px', letterSpacing: '0.2em' }}>← RETOUR</Link>
      </header>

      <div className="px-6 pt-8 pb-6">
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 80px)', fontWeight: '700', letterSpacing: '-0.02em', lineHeight: '1' }}>
          RETOURS & ÉCHANGES
        </h1>
      </div>

      <div className="w-full border-t border-black" />

      <div className="max-w-2xl px-6 py-12 space-y-12">

        {/* France & Union Européenne */}
        <section>
          <h2 style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600', marginBottom: '24px' }}>
            FRANCE & UNION EUROPÉENNE
          </h2>
          <div className="space-y-4" style={{ fontSize: '14px', lineHeight: '1.7', color: '#333' }}>
            <p>Conformément à la législation européenne, vous disposez d'un délai de <strong>14 jours</strong> à compter de la réception de votre commande pour exercer votre droit de rétractation, sans avoir à justifier votre décision.</p>
            <p>Les frais de retour sont à notre charge. Contactez-nous à <a href="mailto:nouvelleriveparis@gmail.com" style={{ color: bleuElectrique }}>nouvelleriveparis@gmail.com</a> pour obtenir une étiquette de retour.</p>
            <p>Le remboursement sera effectué dans un délai de 14 jours après réception du produit retourné, par le même moyen de paiement utilisé lors de l'achat.</p>
            <p style={{ fontSize: '12px', color: '#999' }}>Les articles doivent être retournés dans leur état d'origine, non portés et non endommagés.</p>
          </div>
        </section>

        {/* International */}
        <section>
          <h2 style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600', marginBottom: '24px' }}>
            INTERNATIONAL (ÉTATS-UNIS, ROYAUME-UNI, JAPON...)
          </h2>
          <div className="space-y-4" style={{ fontSize: '14px', lineHeight: '1.7', color: '#333' }}>
            <p>Les retours sont acceptés uniquement en cas de <strong>produit défectueux ou non conforme</strong> à la description.</p>
            <p>En cas de problème, contactez-nous dans les <strong>7 jours</strong> suivant la réception à <a href="mailto:nouvelleriveparis@gmail.com" style={{ color: bleuElectrique }}>nouvelleriveparis@gmail.com</a> avec photos à l'appui.</p>
            <p>Les frais de retour international sont à la charge du client.</p>
          </div>
        </section>

        {/* Échanges */}
        <section>
          <h2 style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600', marginBottom: '24px' }}>
            ÉCHANGES
          </h2>
          <div className="space-y-4" style={{ fontSize: '14px', lineHeight: '1.7', color: '#333' }}>
            <p>Chaque pièce Nouvelle Rive est unique. Les échanges sont possibles uniquement contre un avoir, dans la limite des stocks disponibles.</p>
            <p>Contactez-nous à <a href="mailto:nouvelleriveparis@gmail.com" style={{ color: bleuElectrique }}>nouvelleriveparis@gmail.com</a></p>
          </div>
        </section>

        {/* Contact */}
        <section className="pt-6 border-t border-black">
          <p style={{ fontSize: '11px', letterSpacing: '0.15em', color: '#999' }}>
            NOUVELLE RIVE — 8 RUE DES ÉCOUFFES, 75004 PARIS
          </p>
        </section>

      </div>
    </div>
  )
}