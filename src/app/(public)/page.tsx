import type { Metadata } from 'next'
import Link from 'next/link'
import { adminDb } from '@/lib/firebaseAdmin'

export const metadata: Metadata = {
  title: 'Vintage et upcyclé chinés à Paris',
  description:
    "Boutique vintage et upcyclée au cœur du Marais à Paris. Pièces uniques chinées par des créatrices indépendantes — vintage de luxe, upcycling, créateurs. 8 rue des Ecouffes, 75004 Paris.",
  alternates: { canonical: 'https://www.nouvellerive.eu/' },
  openGraph: {
    title: 'Nouvelle Rive — Vintage et upcyclé chinés à Paris',
    description: "Boutique vintage et upcyclée au cœur du Marais à Paris.",
    url: 'https://www.nouvellerive.eu',
    type: 'website',
    siteName: 'Nouvelle Rive',
    images: [{ url: '/facade%20paysage.jpg', width: 1200, height: 630, alt: 'Nouvelle Rive — Boutique 8 rue des Ecouffes, Le Marais' }],
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nouvelle Rive — Vintage et upcyclé chinés à Paris',
    description: "Boutique vintage et upcyclée au cœur du Marais à Paris.",
    images: ['/facade%20paysage.jpg'],
  },
}

export const revalidate = 300

const fontHelvetica = '"Helvetica Neue", Helvetica, Arial, sans-serif'

const categories = [
  { label: 'Femme', href: '/femme' },
  { label: 'Homme', href: '/homme' },
  { label: 'Luxe', href: '/luxe' },
  { label: 'Accessoires', href: '/accessoires' },
]

const universes = [
  { label: 'Les iconiques', href: '/les-iconiques', subtitle: "Levi's 501, Hermès, perfectos…" },
  { label: 'Pièces upcyclées', href: '/iconiques-upcy', subtitle: 'Tailleurs ÂGE, deadstock luxe…' },
  { label: 'Nos créatrices', href: '/nos-creatrices', subtitle: 'Chineuses indépendantes' },
]

type FeaturedProduct = {
  id: string
  nom: string
  marque: string
  prix: number
  imageUrl: string
}

async function getFeaturedProducts(): Promise<FeaturedProduct[]> {
  try {
    const snap = await adminDb
      .collection('produits')
      .where('vendu', '==', false)
      .limit(60)
      .get()

    const items = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as any))
      .filter(p =>
        p.statut !== 'supprime' &&
        p.statut !== 'retour' &&
        (p.quantite ?? 1) > 0 &&
        p.prix > 0 &&
        (p.photos?.face || p.imageUrls?.[0] || p.imageUrl)
      )
      .map(p => {
        const cleanedNom = (p.nom || '').replace(/^[A-Z]{2,10}\d{1,4}\s*[-–]\s*/i, '').trim()
        return {
          id: p.id,
          nom: cleanedNom,
          marque: (p.marque || '').trim(),
          prix: p.prix,
          imageUrl: p.photos?.face || p.imageUrls?.[0] || p.imageUrl,
          likesCount: p.likesCount || 0,
          createdAtMs: p.createdAt?.toMillis?.() ?? 0,
        }
      })
      .sort((a, b) => {
        if (b.likesCount !== a.likesCount) return b.likesCount - a.likesCount
        return b.createdAtMs - a.createdAtMs
      })
      .slice(0, 8)
      .map(({ likesCount: _l, createdAtMs: _c, ...rest }) => rest)

    return items
  } catch (err) {
    console.error('[home] getFeaturedProducts error:', err)
    return []
  }
}

export default async function HomePage() {
  const featured = await getFeaturedProducts()

  return (
    <main style={{ fontFamily: fontHelvetica, backgroundColor: '#fff', color: '#000' }}>
      <section style={{ borderBottom: '1px solid #000' }}>
        <div className="px-4 md:px-8 py-16 md:py-28 text-center">
          <h1
            className="uppercase mb-6"
            style={{ fontSize: 'clamp(48px, 12vw, 120px)', fontWeight: 700, lineHeight: 0.95, letterSpacing: '-0.01em' }}
          >
            Nouvelle Rive
          </h1>
          <p
            className="uppercase mb-10"
            style={{ fontSize: 'clamp(14px, 2.5vw, 18px)', letterSpacing: '0.15em', fontWeight: 400 }}
          >
            Vintage et upcyclé chinés à Paris — Le Marais
          </p>
          <p className="mx-auto mb-10" style={{ maxWidth: '640px', fontSize: '15px', lineHeight: 1.7, fontWeight: 300, color: '#333' }}>
            Pièces uniques chinées par des créatrices indépendantes. Vintage de luxe, upcycling, créateurs — toutes les pièces passent par notre boutique du 8 rue des Ecouffes pour une vérification main propre.
          </p>
          <Link
            href="/boutique"
            className="inline-block py-4 px-12 uppercase transition hover:bg-black hover:text-white"
            style={{ fontSize: '13px', letterSpacing: '0.2em', fontWeight: 400, border: '1px solid #000' }}
          >
            Voir la boutique →
          </Link>
        </div>
      </section>

      <section style={{ borderBottom: '1px solid #000' }}>
        <div className="grid grid-cols-2 md:grid-cols-4">
          {categories.map((c, i) => (
            <Link
              key={c.href}
              href={c.href}
              className="text-center py-12 md:py-16 uppercase transition hover:bg-black hover:text-white"
              style={{
                fontSize: '14px',
                letterSpacing: '0.15em',
                fontWeight: 400,
                borderRight: i < categories.length - 1 ? '1px solid #000' : 'none',
              }}
            >
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section style={{ borderBottom: '1px solid #000' }}>
          <div className="px-4 md:px-8 pt-12 md:pt-16 pb-6 text-center">
            <p className="uppercase mb-3" style={{ fontSize: '12px', letterSpacing: '0.2em', color: '#666' }}>
              Sélection du moment
            </p>
            <h2 className="uppercase" style={{ fontSize: 'clamp(24px, 4vw, 36px)', letterSpacing: '0.02em', fontWeight: 700, lineHeight: 1.1 }}>
              Pièces favorites
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4">
            {featured.map((p, i) => {
              const titleAlt = p.marque ? `${p.marque} — ${p.nom}` : p.nom
              const isLastCol = (i + 1) % 4 === 0
              const isLastRow = i >= featured.length - (featured.length % 4 || 4)
              return (
                <Link
                  key={p.id}
                  href={`/boutique/${p.id}`}
                  className="block group"
                  style={{
                    borderRight: !isLastCol ? '1px solid #000' : 'none',
                    borderTop: '1px solid #000',
                    borderBottom: !isLastRow ? '1px solid transparent' : 'none',
                  }}
                >
                  <div className="aspect-square overflow-hidden bg-white">
                    <img
                      src={p.imageUrl}
                      alt={titleAlt}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4 md:p-6 text-center">
                    {p.marque && (
                      <p className="uppercase mb-1" style={{ fontSize: '13px', letterSpacing: '0.1em', fontWeight: 700 }}>
                        {p.marque}
                      </p>
                    )}
                    <p className="mb-2 line-clamp-1" style={{ fontSize: '12px', color: '#666', fontWeight: 300 }}>
                      {p.nom}
                    </p>
                    <p style={{ fontSize: '13px', letterSpacing: '0.02em' }}>
                      {p.prix.toLocaleString('fr-FR')} €
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
          <div className="text-center py-8" style={{ borderTop: '1px solid #000' }}>
            <Link
              href="/boutique"
              className="inline-block py-3 px-8 uppercase transition hover:bg-black hover:text-white"
              style={{ fontSize: '12px', letterSpacing: '0.2em', border: '1px solid #000' }}
            >
              Voir toute la boutique →
            </Link>
          </div>
        </section>
      )}

      <section style={{ borderBottom: '1px solid #000' }}>
        <div className="grid grid-cols-1 md:grid-cols-3">
          {universes.map((u, i) => (
            <Link
              key={u.href}
              href={u.href}
              className="py-12 md:py-16 px-6 text-center transition hover:bg-black hover:text-white group"
              style={{ borderRight: i < universes.length - 1 ? '1px solid #000' : 'none', borderTop: i > 0 ? '1px solid #000' : 'none' }}
            >
              <p className="uppercase mb-2" style={{ fontSize: '15px', letterSpacing: '0.15em' }}>{u.label}</p>
              <p style={{ fontSize: '12px', color: '#888', fontWeight: 300 }} className="group-hover:text-white transition-colors">
                {u.subtitle}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2" style={{ borderBottom: '1px solid #000' }}>
        <div className="p-8 md:p-16" style={{ borderRight: '1px solid #000' }}>
          <p className="uppercase mb-4" style={{ fontSize: '12px', letterSpacing: '0.2em', color: '#666' }}>
            Visitez-nous
          </p>
          <h2 className="uppercase mb-6" style={{ fontSize: 'clamp(24px, 4vw, 36px)', letterSpacing: '0.02em', fontWeight: 700, lineHeight: 1.1 }}>
            Boutique au Marais
          </h2>
          <p className="mb-4" style={{ fontSize: '15px', lineHeight: 1.7 }}>
            8 rue des Ecouffes<br />
            75004 Paris
          </p>
          <p className="mb-8" style={{ fontSize: '13px', color: '#666', lineHeight: 1.8 }}>
            Lundi 11h–20h<br />
            Mardi à jeudi 12h–20h<br />
            Vendredi à dimanche 11h–20h
          </p>
          <Link
            href="/nous-rencontrer"
            className="inline-block py-3 px-8 uppercase transition hover:bg-black hover:text-white"
            style={{ fontSize: '12px', letterSpacing: '0.2em', border: '1px solid #000' }}
          >
            Plan & itinéraire →
          </Link>
        </div>
        <div className="overflow-hidden" style={{ minHeight: '320px' }}>
          <img
            src="/facade%20paysage.jpg"
            alt="Boutique Nouvelle Rive — 8 rue des Ecouffes, Le Marais Paris"
            className="w-full h-full object-cover"
            style={{ minHeight: '320px' }}
          />
        </div>
      </section>

      <section className="text-center py-16 md:py-24 px-4 md:px-8">
        <p className="uppercase mb-6" style={{ fontSize: '12px', letterSpacing: '0.2em', color: '#666' }}>
          Notre manifesto
        </p>
        <p className="mx-auto mb-10" style={{ maxWidth: '720px', fontSize: '20px', lineHeight: 1.6, fontWeight: 300 }}>
          Repenser la mode par le vintage et l&apos;upcycling. Soutenir les créatrices indépendantes. Faire vivre la mode circulaire au cœur du Marais.
        </p>
        <Link
          href="/manifesto"
          className="uppercase inline-block hover:opacity-50 transition"
          style={{ fontSize: '12px', letterSpacing: '0.2em', borderBottom: '1px solid #000', paddingBottom: '4px' }}
        >
          Lire le manifesto
        </Link>
      </section>
    </main>
  )
}
