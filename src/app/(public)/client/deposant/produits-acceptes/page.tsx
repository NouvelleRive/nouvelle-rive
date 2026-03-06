'use client'

const marques = [
  { nom: 'ALAÏA', categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, ceintures, bijoux, souliers' },
  { nom: 'ALEXANDER MCQUEEN', categories: 'Prêt-à-porter, petite maroquinerie, ceintures, souliers' },
  { nom: 'ANN DEMEULEMEESTER', categories: 'Prêt-à-porter' },
  { nom: 'AZZARO', categories: 'Prêt-à-porter (hors formel)' },
  { nom: 'BALENCIAGA', categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, ceintures' },
  { nom: 'BALMAIN', categories: 'Prêt-à-porter (hors formel)' },
  { nom: 'BOTTEGA VENETA', categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, ceintures, souliers' },
  { nom: 'BURBERRY', categories: 'Prêt-à-porter, maroquinerie, ceintures' },
  { nom: 'CÉLINE', categories: 'Prêt-à-porter' },
  { nom: 'CÉDRIC CHARLIER', categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, bijoux, souliers' },
  { nom: 'CHANEL', categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, bijoux, souliers, ceintures' },
  { nom: 'CHLOÉ', categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, ceintures, bijoux' },
  { nom: 'CHRISTIAN DIOR', categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, bijoux, souliers, ceintures' },
  { nom: 'CHRISTOPHE', categories: 'Sacs, ceintures' },
  { nom: 'COMME DES GARÇONS', categories: 'Prêt-à-porter, petite maroquinerie, ceintures, souliers' },
  { nom: 'COURRÈGES', categories: 'Prêt-à-porter, petite maroquinerie, maroquinerie' },
  { nom: 'DELVAUX', categories: 'Petite maroquinerie' },
  { nom: 'DOLCE & GABBANA', categories: 'Petite maroquinerie' },
  { nom: 'DRIES VAN NOTEN', categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, ceintures' },
  { nom: 'EMILIO PUCCI', categories: 'Prêt-à-porter, maroquinerie, ceintures' },
  { nom: 'FENDI', categories: 'Petite maroquinerie' },
  { nom: 'GIORGIO ARMANI', categories: 'Prêt-à-porter, maroquinerie' },
  { nom: 'GIVENCHY', categories: 'Prêt-à-porter, maroquinerie, ceintures' },
  { nom: 'GUCCI', categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, ceintures, bijoux, objets' },
  { nom: 'HELMUT LANG', categories: 'Prêt-à-porter' },
  { nom: 'HERMÈS', categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, souliers, ceintures, bijoux, foulards' },
  { nom: 'ISABEL MARANT', categories: 'Prêt-à-porter, souliers, maroquinerie' },
  { nom: 'ISSEY MIYAKE', categories: 'Prêt-à-porter, souliers' },
  { nom: 'JACQUEMUS', categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie' },
  { nom: 'JEAN PAUL GAULTIER', categories: 'Prêt-à-porter (hors Homme)' },
  { nom: 'JIL SANDER', categories: 'Prêt-à-porter, maroquinerie' },
  { nom: 'JUNYA WATANABE', categories: 'Prêt-à-porter' },
  { nom: 'JW ANDERSON', categories: 'Prêt-à-porter' },
  { nom: 'KHAITE', categories: 'Prêt-à-porter' },
  { nom: 'LANVIN', categories: 'Petite maroquinerie' },
  { nom: 'LEMAIRE', categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie' },
  { nom: 'LÉONARD', categories: 'Prêt-à-porter' },
  { nom: 'LOEWE', categories: 'Prêt-à-porter' },
  { nom: 'LORO PIANA', categories: 'Prêt-à-porter, maroquinerie' },
    { nom: 'LOUIS VUITTON', categories: 'Maroquinerie, petite maroquinerie, prêt-à-porter, souliers' },
  { nom: 'MARGIELA', categories: 'Prêt-à-porter, maroquinerie' },
  { nom: 'MAX MARA', categories: 'Manteaux, souliers' },
  { nom: 'MISSONI', categories: 'Prêt-à-porter, petite maroquinerie, souliers' },
  { nom: 'MIU MIU', categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, souliers' },
  { nom: 'MONCLER', categories: 'Prêt-à-porter, maroquinerie' },
  { nom: 'MONTANA', categories: 'Prêt-à-porter (hors Homme)' },
  { nom: 'NINA RICCI', categories: 'Prêt-à-porter, maroquinerie' },
  { nom: 'PACO RABANNE', categories: 'Prêt-à-porter, maroquinerie' },
  { nom: 'PRADA', categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, souliers, ceintures' },
  { nom: 'PROENZA SCHOULER', categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, ceintures, bijoux, souliers' },
  { nom: 'RICK OWENS', categories: 'Prêt-à-porter' },
  { nom: 'ROBERTO CAVALLI', categories: 'Prêt-à-porter, maroquinerie' },
  { nom: 'SACAI', categories: 'Prêt-à-porter' },
  { nom: 'SAINT LAURENT', categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, ceintures, bijoux, foulards' },
  { nom: 'SCHIAPARELLI', categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, bijoux, ceintures' },
  { nom: 'STELLA MC CARTNEY', categories: 'Prêt-à-porter, maroquinerie' },
  { nom: 'THE ROW', categories: 'Prêt-à-porter, maroquinerie, souliers' },
  { nom: 'THIERRY MUGLER', categories: 'Prêt-à-porter (hors Homme)' },
  { nom: 'THOM BROWNE', categories: 'Prêt-à-porter' },
  { nom: 'VALENTINO', categories: 'Prêt-à-porter, maroquinerie, petite maroquinerie, ceintures, bijoux, souliers' },
  { nom: 'VERSACE', categories: 'Prêt-à-porter, maroquinerie, ceintures, bijoux' },
  { nom: 'VICTORIA BECKHAM', categories: 'Prêt-à-porter' },
  { nom: 'VIVIENNE WESTWOOD', categories: 'Prêt-à-porter, petite maroquinerie, maroquinerie, foulards, ceintures, bijoux' },
  { nom: 'YOHJI YAMAMOTO', categories: 'Prêt-à-porter' },
  { nom: 'YVES SAINT LAURENT', categories: 'Prêt-à-porter' },
  { nom: 'ZIMMERMANN', categories: 'Prêt-à-porter' },
]

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

      {/* FOOTER NOTE */}
      <div style={{ padding: '32px 40px', borderTop: '1px solid #000', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <p style={{ fontSize: '13px', color: '#666' }}>
          Votre marque n'est pas dans la liste ? Écrivez-nous, nous étudions chaque cas.
        </p>
        <a
          href="mailto:nouvelleriveparis@gmail.com"
          style={{ ...label, color: bleu, textDecoration: 'underline', textUnderlineOffset: '4px' }}
        >
          NOUS CONTACTER →
        </a>
      </div>

    </div>
  )
}