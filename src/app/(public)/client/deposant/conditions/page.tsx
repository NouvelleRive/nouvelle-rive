'use client'

import Link from 'next/link'

const PHOTOS = [
  'PHOTO_BOUTIQUE_1', // remplacer par URL Bunny CDN
  'PHOTO_BOUTIQUE_2',
  'PHOTO_BOUTIQUE_3',
]

export default function ConditionsDeposantPage() {
  const font = '"Helvetica Neue", Helvetica, Arial, sans-serif'
  const bleu = '#0000FF'

  const label: React.CSSProperties = {
    fontSize: '11px',
    letterSpacing: '0.2em',
    fontWeight: '600',
    fontFamily: font,
  }

  return (
    <div style={{ fontFamily: font, backgroundColor: '#fff', color: '#000' }}>

      {/* HERO */}
      <div className="relative overflow-hidden" style={{ borderBottom: '1px solid #000' }}>
        <div className="flex" style={{ minHeight: '480px' }}>

          {/* Texte gauche */}
          <div className="flex flex-col justify-between p-10" style={{ width: '50%', borderRight: '1px solid #000' }}>
            <p style={{ ...label, color: bleu }}>VENDRE CHEZ NOUVELLE RIVE</p>
            <div>
              <h1 style={{ fontSize: '52px', fontWeight: '700', lineHeight: '1.05', letterSpacing: '-0.02em', marginBottom: '24px' }}>
                Votre garde-robe<br/>mérite une<br/>seconde vie.
              </h1>
              <p style={{ fontSize: '15px', lineHeight: '1.7', maxWidth: '380px', color: '#444' }}>
                Chez Nouvelle Rive, chaque pièce est choisie avec soin. Nous prenons en charge la mise en valeur, la vente, et vous reversons l'essentiel — parce que votre confiance vaut plus qu'une commission.
              </p>
            </div>
            <p style={{ ...label, color: '#888' }}>8 RUE DES ÉCOUFFES — PARIS 4E</p>
          </div>

          {/* Photos droite */}
          <div className="flex" style={{ width: '50%' }}>
            {PHOTOS.map((url, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  borderLeft: i > 0 ? '1px solid #000' : undefined,
                  backgroundColor: '#f0f0f0',
                  backgroundImage: url.startsWith('http') ? `url(${url})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '480px',
                }}
              >
                {!url.startsWith('http') && (
                  <span style={{ ...label, color: '#aaa' }}>PHOTO</span>
                )}
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* CONDITIONS */}
      <div style={{ borderBottom: '1px solid #000' }}>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
              ),
              titre: 'Notre commission',
              texte: "60% du prix de vente en virement, ou 70% en bon d\u2019achat boutique.",
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
              ),
              titre: 'Durée du dépôt',
              texte: '60 jours de mise en vente. À 30 jours : réduction 15% ou retour de la pièce.',
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                </svg>
              ),
              titre: 'Paiement',
              texte: 'Vous choisissez chaque mois votre mode. Versement le 10 du mois suivant.',
            },
            {
              icon: (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                </svg>
              ),
              titre: 'Sélection',
              texte: 'Prêt-à-porter, sacs, bijoux, chaussures vintage en bon état. Chaque pièce est validée.',
            },
          ].map(({ icon, titre, texte }, i) => (
            <div
              key={i}
              className="p-8"
              style={{ borderLeft: i > 0 ? '1px solid #000' : undefined }}
            >
              <div style={{ color: bleu, marginBottom: '16px' }}>{icon}</div>
              <p style={{ ...label, marginBottom: '10px' }}>{titre.toUpperCase()}</p>
              <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#444' }}>{texte}</p>
            </div>
          ))}
        </div>
      </div>

      {/* LIEN PRODUITS ACCEPTÉS */}
      <div className="flex items-center justify-between px-10 py-5" style={{ borderBottom: '1px solid #000' }}>
        <p style={{ ...label, color: '#666' }}>Vous voulez savoir si vos pièces sont éligibles ?</p>
        <Link
          href="/client/deposant/produits-acceptes"
          style={{ ...label, color: bleu, textDecoration: 'underline', textUnderlineOffset: '4px' }}
        >
          VOIR LES PIÈCES ACCEPTÉES →
        </Link>
      </div>

      {/* COMMENT ÇA MARCHE */}
      <div style={{ borderBottom: '1px solid #000' }}>
        <div className="grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
          <div className="p-10" style={{ borderRight: '1px solid #000' }}>
            <p style={label}>COMMENT ÇA MARCHE</p>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {[
              { n: '01', titre: 'Créer votre compte', texte: 'Créez votre espace déposant. Si vous avez déjà un compte client Nouvelle Rive, vos informations sont récupérées automatiquement.' },
              { n: '02', titre: 'Décrire vos pièces', texte: 'Ajoutez vos articles avec photos et descriptions. Notre équipe valide chaque fiche avant publication.' },
              { n: '03', titre: 'Déposer en boutique', texte: 'Réservez un créneau pour apporter vos pièces au 8 rue des Écouffes. On s\'occupe du reste.' },
            ].map(({ n, titre, texte }, i) => (
              <div key={i} className="p-8" style={{ borderLeft: '1px solid #000' }}>
                <p style={{ fontSize: '32px', fontWeight: '700', color: bleu, marginBottom: '16px' }}>{n}</p>
                <p style={{ ...label, marginBottom: '10px' }}>{titre.toUpperCase()}</p>
                <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#444' }}>{texte}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Link
          href="/client/deposant/nouveau"
          className="flex items-center justify-between p-10 transition-all"
          style={{ backgroundColor: bleu, color: 'white', borderRight: '1px solid #0000cc' }}
        >
          <div>
            <p style={{ ...label, color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>DÉPÔT EN LIGNE</p>
            <p style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.01em' }}>Faire mon premier dépôt en ligne</p>
          </div>
          <span style={{ fontSize: '32px', fontWeight: '200' }}>→</span>
        </Link>
        <button
          disabled
          className="flex items-center justify-between p-10"
          style={{ backgroundColor: '#f5f5f5', color: '#aaa', cursor: 'not-allowed', width: '100%', textAlign: 'left' }}
        >
          <div>
            <p style={{ ...label, color: '#bbb', marginBottom: '8px' }}>BIENTÔT DISPONIBLE</p>
            <p style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.01em' }}>Prendre RDV pour un dépôt en physique</p>
          </div>
          <span style={{ fontSize: '32px', fontWeight: '200' }}>→</span>
        </button>
      </div>

    </div>
  )
}
