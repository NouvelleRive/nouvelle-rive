'use client'

import Link from 'next/link'

const PHOTOS = [
  'PHOTO_BOUTIQUE_1',
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

  const conditions = [
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
        </svg>
      ),
      titre: 'Notre commission',
      texte: '40% en cash,\n30% en bons d\'achat valables sans limite de temps.',
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
      ),
      titre: 'Durée du dépôt',
      texte: '30 jours de dépôt,\nrenouvelable 30 jours sous condition de baisse du prix.',
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
      lien: '/client/deposant/produits-acceptes',
      lienLabel: 'Découvrir les pièces éligibles',
    },
  ]

  const etapes = [
    { n: '01', titre: 'Créer votre compte', texte: 'Créez votre espace déposant. Si vous avez déjà un compte client Nouvelle Rive, vos informations sont récupérées automatiquement.' },
    { n: '02', titre: 'Décrire vos pièces', texte: 'Ajoutez vos articles avec photos et descriptions. Notre équipe valide chaque fiche avant publication.' },
    { n: '03', titre: 'Déposer en boutique', texte: 'Réservez un créneau pour apporter vos pièces au 8 rue des Écouffes. On s\'occupe du reste.' },
  ]

  return (
    <div style={{ fontFamily: font, backgroundColor: '#fff', color: '#000' }}>

      <style>{`
        .hero { display: flex; min-height: 480px; border-bottom: 1px solid #000; }
        .hero-left { width: 50%; border-right: 1px solid #000; padding: 40px; display: flex; flex-direction: column; justify-content: space-between; }
        .hero-right { width: 50%; display: flex; }
        .photo-col { flex: 1; background-color: #f0f0f0; display: flex; align-items: center; justify-content: center; min-height: 480px; }
        .conditions-grid { display: grid; grid-template-columns: repeat(4, 1fr); border-bottom: 1px solid #000; }
        .condition-card { padding: 32px; display: flex; flex-direction: column; }
        .etapes-grid { display: grid; grid-template-columns: 1fr 2fr; border-bottom: 1px solid #000; }
        .etapes-right { display: grid; grid-template-columns: repeat(3, 1fr); }
        .cta-grid { display: grid; grid-template-columns: 1fr 1fr; }

        @media (max-width: 768px) {
          .hero { flex-direction: column; min-height: auto; }
          .hero-left { width: 100%; border-right: none; border-bottom: 1px solid #000; padding: 24px; min-height: auto; }
          .hero-right { width: 100%; height: 220px; }
          .photo-col { min-height: 220px; }
          .conditions-grid { grid-template-columns: repeat(2, 1fr); align-items: stretch; }
          .condition-card { padding: 20px; border-bottom: 1px solid #000; height: 100%; box-sizing: border-box; }
          .etapes-grid { grid-template-columns: 1fr; }
          .etapes-label { display: none; }
          .etapes-right { grid-template-columns: 1fr; border-left: none !important; }
          .etape-card { border-left: none !important; border-top: 1px solid #000; }
          .cta-grid { grid-template-columns: 1fr; }
          .cta-physique { border-top: 1px solid #000; }
          .bandeau-eligibles { flex-direction: column; gap: 12px; }
          h1 { font-size: 32px !important; }
        }
      `}</style>

      {/* HERO */}
      <div className="hero">
        <div className="hero-left">
          <p style={{ ...label, color: bleu, marginBottom: '12px' }}>VENDRE CHEZ NOUVELLE RIVE</p>
          <div>
            <h1 style={{ fontSize: '52px', fontWeight: '700', lineHeight: '1.05', letterSpacing: '-0.02em', marginBottom: '16px' }}>
              Votre garde-robe<br/>mérite une<br/>seconde vie.
            </h1>
            <p style={{ fontSize: '15px', lineHeight: '1.7', maxWidth: '420px', color: '#444', marginBottom: '24px' }}>
              Vendez ce que vous ne portez plus ! Nous prenons en dépôt vos pièces pendant deux mois. Une fois la pièce vendue vous récupérez 60 à 70% de la valeur.{' '}
              <br/><Link href="/client/deposant/produits-acceptes" style={{ color: bleu, textDecoration: 'underline', textUnderlineOffset: '3px' }}>Découvrez les pièces éligibles.</Link>
            </p>
          </div>
          <a href="https://www.nouvellerive.eu/nous-rencontrer" style={{ ...label, color: '#888', textDecoration: 'none' }}>8 RUE DES ÉCOUFFES — PARIS 4E →</a>
        </div>

        <div className="hero-right">
          {PHOTOS.map((url, i) => (
            <div
              key={i}
              className="photo-col"
              style={{
                borderLeft: i > 0 ? '1px solid #000' : undefined,
                backgroundImage: url.startsWith('http') ? `url(${url})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              {!url.startsWith('http') && (
                <span style={{ ...label, color: '#aaa' }}>PHOTO</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CONDITIONS */}
      <div className="conditions-grid" style={{ alignItems: 'stretch' }}>
        {conditions.map(({ icon, titre, texte, lien, lienLabel }, i) => (
          <div
            key={i}
            className="condition-card"
            style={{
              borderLeft: i > 0 ? '1px solid #000' : undefined,
              backgroundColor: lien ? bleu : undefined,
              color: lien ? 'white' : undefined,
            }}
          >
            <div style={{ color: lien ? 'white' : bleu, marginBottom: '16px' }}>{icon}</div>
            <p style={{ ...label, marginBottom: '10px', color: lien ? 'white' : undefined }}>{titre.toUpperCase()}</p>
            <p style={{ fontSize: '13px', lineHeight: '1.7', color: lien ? 'rgba(255,255,255,0.85)' : '#444', whiteSpace: 'pre-line' }}>{texte}</p>
            {lien && (
              <Link href={lien} style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '700', color: 'white', textDecoration: 'underline', textUnderlineOffset: '4px', marginTop: '12px', display: 'block' }}>
                {lienLabel} →
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* MANIFESTO */}
      <div style={{ backgroundColor: '#fff', padding: '32px', borderBottom: '1px solid #000', borderTop: '1px solid #000' }}>
        <div style={{ display: 'flex', gap: '48px', alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            'Plus d\'argent sur votre compte',
            'Plus de place dans vos placards',
            'Des pièces accessibles pour nos copines',
            'Une planète plus propre',
          ].map((texte, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: bleu, display: 'inline-block', flexShrink: 0 }} />
              <p style={{ ...label }}>{texte.toUpperCase()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* COMMENT ÇA MARCHE */}
      <div className="etapes-grid">
        <div className="etapes-label" style={{ padding: '40px', borderRight: '1px solid #000' }}>
          <p style={label}>COMMENT ÇA MARCHE</p>
        </div>
        <div className="etapes-right" style={{ borderLeft: undefined }}>
          {etapes.map(({ n, titre, texte }, i) => (
            <div key={i} className="etape-card" style={{ padding: '32px', borderLeft: '1px solid #000' }}>
              <p style={{ fontSize: '32px', fontWeight: '700', color: bleu, marginBottom: '16px' }}>{n}</p>
              <p style={{ ...label, marginBottom: '10px' }}>{titre.toUpperCase()}</p>
              <p style={{ fontSize: '13px', lineHeight: '1.7', color: '#444' }}>{texte}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="cta-grid">
        <Link
          href="/client/deposant/nouveau"
          className="cta-online"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '40px', backgroundColor: bleu, color: 'white', borderRight: '1px solid #0000cc', textDecoration: 'none' }}
        >
          <div>
            <p style={{ ...label, color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>DÉPÔT EN LIGNE</p>
            <p style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.01em' }}>Faire mon premier dépôt en ligne</p>
          </div>
          <span style={{ fontSize: '32px', fontWeight: '200', marginLeft: '16px' }}>→</span>
        </Link>
        <button
          disabled
          className="cta-physique"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '40px', backgroundColor: '#f5f5f5', color: '#aaa', cursor: 'not-allowed', width: '100%', textAlign: 'left', border: 'none' }}
        >
          <div>
            <p style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600', color: '#bbb', marginBottom: '8px' }}>BIENTÔT DISPONIBLE</p>
            <p style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.01em' }}>Prendre RDV pour un dépôt en physique</p>
          </div>
          <span style={{ fontSize: '32px', fontWeight: '200', marginLeft: '16px' }}>→</span>
        </button>
      </div>

    </div>
  )
}