'use client'

import { MARQUES_DEPOSANTE } from '@/lib/marquesDeposante'

const marques = MARQUES_DEPOSANTE

export default function ProduitsAcceptesPage() {
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

      <style>{`
        .marques-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }
        @media (max-width: 900px) {
          .marques-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 500px) {
          .marques-grid { grid-template-columns: 1fr; }
          .header-inner { flex-direction: column; gap: 12px; }
          h1.page-titre { font-size: 28px !important; }
        }
      `}</style>

      {/* HEADER */}
      <div style={{ borderBottom: '1px solid #000', padding: '40px' }}>
        <p style={{ ...label, color: bleu, marginBottom: '16px' }}>VENDRE CHEZ NOUVELLE RIVE</p>
        <div className="header-inner" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px' }}>
          <h1 className="page-titre" style={{ fontSize: '48px', fontWeight: '700', lineHeight: '1.05', letterSpacing: '-0.02em', margin: 0 }}>
            Marques &amp; catégories<br/>éligibles
          </h1>
          <p style={{ fontSize: '13px', color: '#666', maxWidth: '320px', lineHeight: '1.6', flexShrink: 0 }}>
            Homme et Femme. Cette liste n'est pas exhaustive — contactez-nous si vous avez un doute sur une pièce.
          </p>
        </div>
      </div>

      {/* GRILLE MARQUES */}
      <div className="marques-grid">
        {marques.map(({ nom, categories }, i) => {
          const col = i % 4
          const row = Math.floor(i / 4)
          return (
            <div
              key={nom}
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #000',
                borderLeft: col > 0 ? '1px solid #000' : undefined,
              }}
            >
              <p style={{ ...label, marginBottom: '4px' }}>{nom}</p>
              <p style={{ fontSize: '11px', color: '#888', lineHeight: '1.5', letterSpacing: '0.02em' }}>{categories}</p>
            </div>
          )
        })}
      </div>

      {/* CTA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <Link
          href="/client/deposant/nouveau"
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