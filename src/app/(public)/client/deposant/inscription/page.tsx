'use client'

import Link from 'next/link'

export default function DeposantInscriptionPage() {
  const fontHelvetica = '"Helvetica Neue", Helvetica, Arial, sans-serif'
  const bleu = '#0000FF'

  const label = {
    fontSize: '11px',
    letterSpacing: '0.2em',
    fontWeight: '600' as const,
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: fontHelvetica }}>
      <div className="px-6 py-12 max-w-2xl">

        <p className="uppercase mb-8" style={label}>Vendre chez Nouvelle Rive</p>
        <div style={{ borderBottom: '1px solid #000' }} className="mb-10" />

        {/* CONDITIONS */}
        <div className="space-y-8 mb-12">

          <div>
            <p className="uppercase mb-3" style={label}>Notre commission</p>
            <p className="text-sm">Vous recevez <strong>60% du prix de vente</strong> en virement bancaire, ou <strong>70%</strong> sous forme de bon d'achat à utiliser en boutique.</p>
          </div>

          <div>
            <p className="uppercase mb-3" style={label}>Durée du dépôt</p>
            <p className="text-sm">Vos pièces sont mises en vente pour une durée de <strong>60 jours</strong>. Au bout de 30 jours sans vente, nous vous proposons soit une réduction de 15% sur le prix, soit le retour de votre pièce.</p>
          </div>

          <div>
            <p className="uppercase mb-3" style={label}>Paiement</p>
            <p className="text-sm">Chaque mois, vous choisissez votre mode de paiement (virement ou bon d'achat) avant la fin du mois. Le règlement est effectué le <strong>10 du mois suivant</strong>.</p>
          </div>

          <div>
            <p className="uppercase mb-3" style={label}>Ce que nous acceptons</p>
            <p className="text-sm">Pièces vintage et de seconde main en bon état : prêt-à-porter, sacs, accessoires, chaussures, bijoux. Chaque pièce est sélectionnée par notre équipe lors du dépôt.</p>
          </div>

        </div>

        <div style={{ borderBottom: '1px solid #000' }} className="mb-10" />

        {/* PROCESS 3 ÉTAPES */}
        <div className="mb-10">
          <p className="uppercase mb-6" style={label}>Comment ça marche</p>
          <div className="space-y-4">
            {[
              { n: '01', title: 'Créer votre compte', desc: 'Créez votre espace déposant en quelques minutes. Si vous avez déjà un compte client, vos informations sont récupérées automatiquement.' },
              { n: '02', title: 'Décrire vos pièces', desc: 'Ajoutez vos articles avec photos et informations. Notre équipe valide chaque fiche avant mise en ligne.' },
              { n: '03', title: 'Choisir votre créneau', desc: 'Réservez un rendez-vous pour déposer vos pièces en boutique au 8 rue des Écouffes, Paris 4e.' },
            ].map(({ n, title, desc }) => (
              <div key={n} className="flex gap-6 items-start">
                <span className="shrink-0" style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600', color: bleu }}>{n}</span>
                <div>
                  <p className="uppercase mb-1" style={label}>{title}</p>
                  <p className="text-sm text-gray-600">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BOUTONS */}
        <div className="space-y-3">
          <Link
            href="/client/deposant/nouveau"
            className="block text-center py-3 uppercase transition-all duration-200 hover:opacity-80"
            style={{ backgroundColor: bleu, color: 'white', fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
          >
            Faire mon premier dépôt en ligne
          </Link>
          <button
            disabled
            className="w-full py-3 uppercase border border-black opacity-40 cursor-not-allowed"
            style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
          >
            Prendre RDV pour un dépôt en physique
          </button>
        </div>

      </div>
    </div>
  )
}