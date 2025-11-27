// app/nous-rencontrer/page.tsx

const bleuElectrique = '#0000FF'

export default function NousRencontrerPage() {
  return (
    <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      
      <main className="min-h-screen bg-white">
        
        {/* Hero */}
        <div className="px-6 py-20">
          <h1 
            style={{ 
              fontSize: 'clamp(40px, 8vw, 120px)',
              fontWeight: '700',
              letterSpacing: '-0.03em',
              lineHeight: '0.9',
              textTransform: 'uppercase'
            }}
          >
            8 RUE DES<br />ECOUFFES
          </h1>
        </div>

        {/* Trait */}
        <div className="w-full border-t border-black" />

        {/* Contenu principal */}
        <div className="grid grid-cols-1 lg:grid-cols-2">
          
          {/* Gauche - Infos */}
          <div className="p-6 lg:p-12 lg:border-r border-black">
            
            {/* Adresse */}
            <div className="mb-12">
              <p style={{ fontSize: '12px', fontWeight: '500', lineHeight: '1.6' }}>
                Plein coeur Marais, quartier des Arts, de la Mode, de la tolérance, la boutique NOUVELLE RIVE se niche rue des Ecouffes, la rue de vêtements, et l'ancienne rue aux filles. Elle réhabilite la première boite lesbienne du Marais, le 3W, Women With Women. La cabine de la dj se transforme en caisse, le fumoir en espace d'exposition premium. Une nouvelle vie tout aussi résolument féministe.
              </p>
              <p className="mt-4" style={{ fontSize: '18px', fontWeight: '500', lineHeight: '1.3' }}>
                Le Marais, 75004 Paris
              </p>
              <p className="mt-2" style={{ fontSize: '14px', color: '#666' }}>
                Métro Saint-Paul (ligne 1)
              </p>
            </div>

            {/* Trait */}
            <div className="w-full border-t border-black mb-12" />

            {/* Horaires */}
            <div className="mb-12">
              <p 
                className="mb-4"
                style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
              >
                HORAIRES
              </p>
              <div className="space-y-2" style={{ fontSize: '16px' }}>
                <div className="flex justify-between max-w-xs">
                  <span>Lundi — Dimanche</span>
                  <span className="font-medium">12h – 20h</span>
                </div>
              </div>
            </div>

            {/* Trait */}
            <div className="w-full border-t border-black mb-12" />

            {/* Contact */}
            <div className="mb-12">
              <p 
                className="mb-4"
                style={{ fontSize: '11px', letterSpacing: '0.2em', fontWeight: '600' }}
              >
                CONTACT
              </p>
              <a 
                href="https://www.instagram.com/nouvellerive" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-block mt-2 hover:opacity-60 transition-opacity"
                style={{ fontSize: '16px', color: bleuElectrique }}
              >
                @nouvelleriveparis
              </a>
            </div>

            {/* Bouton */}
            <a 
              href="https://www.google.com/maps/search/?api=1&query=8+rue+des+Ecouffes+Paris" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-block py-4 px-8 text-white transition-opacity hover:opacity-80"
              style={{ 
                backgroundColor: bleuElectrique,
                fontSize: '11px',
                letterSpacing: '0.2em',
                fontWeight: '600'
              }}
            >
              ITINÉRAIRE
            </a>
          </div>

          {/* Droite - Map */}
          <div className="h-[400px] lg:h-auto lg:min-h-[600px]">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2625.2!2d2.3592!3d48.8565!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x47e671e19ff53a01%3A0x36401da7abfa068d!2s8%20Rue%20des%20%C3%89couffes%2C%2075004%20Paris!5e0!3m2!1sen!2sfr!4v1234567890"
              width="100%"
              height="100%"
              style={{ border: 0, filter: 'grayscale(100%)' }}
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>

        {/* Trait */}
        <div className="w-full border-t border-black" />

        {/* Section finale */}
        <div className="px-6 py-20 text-center">
          <p 
            style={{ 
              fontSize: 'clamp(18px, 3vw, 32px)',
              fontWeight: '500',
              maxWidth: '600px',
              margin: '0 auto',
              lineHeight: '1.4'
            }}
          >
            Le Marais, au cœur de Paris.
            <br />
            <span style={{ color: '#999' }}>Une sélection vintage qui vous ressemble.</span>
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-black py-8 text-center">
        <p style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#999' }}>
          NOUVELLE RIVE — 8 RUE DES ECOUFFES, PARIS
        </p>
      </footer>
    </div>
  )
}