import Link from 'next/link'

const bleuElectrique = '#0000FF'

export default function ConfidentialitePage() {
  return (
    <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }} className="bg-white min-h-screen">
      <header className="px-6 py-4">
        <Link href="/boutique" className="hover:opacity-60 transition-opacity" style={{ fontSize: '11px', letterSpacing: '0.2em' }}>← RETOUR</Link>
      </header>
      <div className="px-6 pt-8 pb-6">
        <h1 style={{ fontSize: 'clamp(28px, 4vw, 80px)', fontWeight: '700', letterSpacing: '-0.02em', lineHeight: '1' }}>
          CONFIDENTIALITÉ
        </h1>
      </div>
      <div className="w-full border-t border-black" />
      <div className="max-w-2xl px-6 py-12 space-y-12">

        <section>
          <h2 style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600', marginBottom: '24px' }}>POLITIQUE DE CONFIDENTIALITÉ</h2>
          <div className="space-y-4" style={{ fontSize: '14px', lineHeight: '1.7', color: '#333' }}>
            <p><strong>Responsable du traitement :</strong> NR1 SAS — 5 Route du Grand Pont, 78110 Le Vésinet</p>

            <p><strong>Données collectées</strong><br />Nous collectons uniquement les données nécessaires au traitement de vos commandes : nom, prénom, email, téléphone, adresse de livraison.</p>

            <p><strong>Finalités</strong><br />Ces données sont utilisées exclusivement pour le traitement et le suivi de vos commandes, et pour vous contacter en cas de besoin.</p>

            <p><strong>Conservation</strong><br />Vos données sont conservées 3 ans à compter de votre dernière commande, conformément à la législation française.</p>

            <p><strong>Partage des données</strong><br />Vos données ne sont jamais vendues à des tiers. Elles sont partagées uniquement avec nos prestataires de paiement (Square) et de livraison, dans le strict cadre du traitement de votre commande.</p>

            <p><strong>Vos droits</strong><br />Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité de vos données. Pour exercer ces droits, contactez-nous à <a href="mailto:nouvelleriveparis@gmail.com" style={{ color: bleuElectrique }}>nouvelleriveparis@gmail.com</a>.</p>

            <p><strong>Cookies</strong><br />Le site utilise des cookies techniques nécessaires à son fonctionnement. Aucun cookie publicitaire n'est déposé sans votre consentement.</p>
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