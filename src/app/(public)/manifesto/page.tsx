// src/app/(public)/manifesto/page.tsx

export default function ManifestoPage() {
  return (
    <div>
      <main 
        className="min-h-screen bg-white"
        style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}
      >
        <div className="bg-gradient-to-b from-gray-50 to-white py-20">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h1 
              className="text-6xl mb-6 font-bold"
              style={{ 
                fontFamily: 'Didot, serif',
                color: '#22209C'
              }}
            >
              NO MORE FAST FASHION
            </h1>
            <p className="text-xl text-gray-700">
              La seule règle dans la mode est la responsabilité
            </p>
          </div>
        </div>

        <section className="max-w-5xl mx-auto px-4 py-16">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-4xl mb-6 font-bold" style={{ color: '#22209C' }}>
                Nouvelle Rive
              </h2>
              <p className="text-lg text-gray-700 mb-4">
                Magasin responsable au cœur du Marais.
              </p>
            </div>
            <div className="bg-gray-100 aspect-square flex items-center justify-center">
              <p className="text-gray-400">[Photo]</p>
            </div>
          </div>
        </section>

        <section className="py-20 text-center">
          <h2 className="text-5xl mb-8 font-bold" style={{ fontFamily: 'Didot, serif', color: '#22209C' }}>
            Le futur sera vintage
          </h2>
          <a href="/boutique" className="inline-block px-8 py-4 text-white font-semibold" style={{ backgroundColor: '#22209C' }}>
            Découvrir la boutique
          </a>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="text-center text-gray-600 text-sm">
          <p>© 2024 Nouvelle Rive</p>
        </div>
      </footer>
    </div>
  )
}