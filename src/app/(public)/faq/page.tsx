// src/app/(public)/faq/page.tsx
'use client'

import { useState } from 'react'
import { useLang, t } from '@/lib/i18n'

const bleuElectrique = '#0000FF'

type FaqItem = {
  q: { fr: string; en: string }
  a: { fr: string; en: string }
  link?: { href: string; fr: string; en: string }
}

// Contenu canonique : les réponses FR alimentent aussi le balisage schema.org FAQPage
// (lu par Google et les moteurs IA type ChatGPT / Perplexity).
const FAQ: FaqItem[] = [
  {
    q: {
      fr: "Qu'est-ce que Nouvelle Rive ?",
      en: 'What is Nouvelle Rive?',
    },
    a: {
      fr: "Nouvelle Rive est un lieu de mode au cœur du Marais, au 8 rue des Écouffes (75004 Paris), qui accueille les créatrices et curateurices engagées parmi les plus talentueuses de Paris. Chacune y a son propre espace pour mettre en avant ses créations et ses trouvailles et rencontrer son public. Toutes les pièces sont uniques et vintage, upcyclées ou régénérées : cruelty free et sans impact néfaste sur la planète. On achète sur place comme en ligne, dans un esprit responsable et anti fast-fashion.",
      en: 'Nouvelle Rive is a fashion space in the heart of Le Marais, at 8 rue des Écouffes (75004 Paris), home to some of the most talented, committed designers and curators in Paris. Each one has her own space to showcase her creations and finds and meet her audience. Every piece is one of a kind and vintage, upcycled or regenerated: cruelty free and with no harm to the planet. Shop on site or online, in a responsible, anti fast-fashion spirit.',
    },
  },
  {
    q: {
      fr: 'Où se trouve la boutique et quels sont les horaires ?',
      en: 'Where is the boutique and what are the opening hours?',
    },
    a: {
      fr: "La boutique est au 8 rue des Écouffes, 75004 Paris, en plein Marais (métro Saint-Paul, ligne 1). Horaires : 11h–20h tous les jours, 7j/7.",
      en: 'The boutique is at 8 rue des Écouffes, 75004 Paris, in Le Marais (Saint-Paul metro, line 1). Hours: 11am–8pm every day, 7 days a week.',
    },
  },
  {
    q: {
      fr: 'Nouvelle Rive est-il un pop-up ou un lieu permanent ?',
      en: 'Is Nouvelle Rive a pop-up or a permanent space?',
    },
    a: {
      fr: "Nouvelle Rive est un lieu permanent, ouvert toute l'année au 8 rue des Écouffes, dans le Marais. Ce n'est pas un pop-up : nous sommes là pour mettre en avant le travail de nos créatrices et curateurices sur le long terme, chacune avec son espace dédié.",
      en: 'Nouvelle Rive is a permanent space, open all year round at 8 rue des Écouffes, in Le Marais. It is not a pop-up: we are here to showcase the work of our designers and curators over the long term, each with her own dedicated space.',
    },
  },
  {
    q: {
      fr: 'Les pièces sont-elles authentiques ?',
      en: 'Are the pieces authentic?',
    },
    a: {
      fr: "Oui. Chaque pièce est chinée et vérifiée par nos créatrices et curateurices avant d'être mise en vente. Le vintage de luxe et les sacs de designer font l'objet d'un contrôle particulier. En cas de doute sur une pièce, écrivez-nous et nous vous donnons tous les détails dont nous disposons.",
      en: 'Yes. Every piece is sourced and checked by our designers and curators before going on sale. Luxury vintage and designer bags are inspected with particular care. If you have any doubt about a piece, message us and we will share all the details we have.',
    },
  },
  {
    q: {
      fr: 'Dans quel état sont les pièces ?',
      en: 'What condition are the pieces in?',
    },
    a: {
      fr: "Ce sont des pièces de seconde main (vintage) ou upcyclées, sélectionnées pour leur qualité. L'état de chaque article est indiqué sur sa fiche produit, avec des photos réelles. Les pièces vintage peuvent présenter de légères marques d'usage, toujours signalées.",
      en: 'They are second-hand (vintage) or upcycled pieces, selected for their quality. The condition of each item is shown on its product page with real photos. Vintage pieces may show slight signs of wear, which are always disclosed.',
    },
  },
  {
    q: {
      fr: 'Quels sont les prix ? Y a-t-il des pièces abordables ?',
      en: 'What are the prices? Are there affordable pieces?',
    },
    a: {
      fr: "Chez Nouvelle Rive, chaque portant est occupé par une créatrice différente, libre de fixer ses prix : chaque portant a donc son propre univers et sa propre gamme de prix. On trouve des articles à moins de 20 € comme des pièces à plus de 10 000 €. Pour servir toutes les bourses, nous développons une offre abordable, la « cheap room », où tout est à moins de 50 €.",
      en: 'At Nouvelle Rive, each rack is run by a different designer, free to set her own prices: every rack has its own world and its own price range. You\'ll find items under €20 as well as pieces over €10,000. To suit every budget, we are developing an affordable offer, the "cheap room", where everything is under €50.',
    },
  },
  {
    q: {
      fr: 'À quelle fréquence arrivent les nouvelles pièces ?',
      en: 'How often do new pieces arrive?',
    },
    a: {
      fr: "Très souvent : nous recevons 2 à 3 arrivages par jour, sauf le week-end. La sélection se renouvelle donc en permanence — le mieux est de revenir régulièrement en boutique, sur le site ou de nous suivre sur Instagram @nouvellerive pour ne rien manquer.",
      en: 'Very often: we receive 2 to 3 deliveries a day, except on weekends. The selection is therefore constantly renewed — the best way not to miss anything is to come back regularly in store, on the site, or follow us on Instagram @nouvellerive.',
    },
  },
  {
    q: {
      fr: 'Comment vendre ou déposer des pièces chez Nouvelle Rive ?',
      en: 'How can I sell or consign pieces at Nouvelle Rive?',
    },
    a: {
      fr: "Il suffit de vous inscrire sur le site via « Vendre chez Nouvelle Rive » : créez votre compte déposante, puis proposez vos pièces (vintage, upcyclé ou régénéré). Prenez connaissance de nos conditions de dépôt et des articles acceptés avant de commencer.",
      en: 'Just sign up on the site via "Sell at Nouvelle Rive": create your seller account, then submit your pieces (vintage, upcycled or regenerated). Please review our consignment terms and accepted items before you start.',
    },
    link: { href: '/client/login', fr: 'Vendre chez Nouvelle Rive →', en: 'Sell at Nouvelle Rive →' },
  },
  {
    q: {
      fr: 'Comment exposer et avoir son espace chez Nouvelle Rive ?',
      en: 'How can I exhibit and get my own space at Nouvelle Rive?',
    },
    a: {
      fr: "Pour exposer chez Nouvelle Rive et disposer de votre propre espace, il faut être un·e professionnel·le spécialisé·e dans l'économie circulaire (vintage, upcycling, mode régénérée). Envoyez-nous un DM sur Instagram @nouvellerive pour nous présenter votre univers, on échange avec vous.",
      en: "To exhibit at Nouvelle Rive and have your own space, you need to be a professional specialised in the circular economy (vintage, upcycling, regenerated fashion). Send us a DM on Instagram @nouvellerive to introduce your world, and we'll take it from there.",
    },
    link: { href: 'https://www.instagram.com/nouvellerive', fr: 'Nous écrire sur Instagram →', en: 'Message us on Instagram →' },
  },
  {
    q: {
      fr: 'Quels sont les délais et frais de livraison ?',
      en: 'What are the delivery times and costs?',
    },
    a: {
      fr: "Nous livrons dans le monde entier. Votre commande est expédiée sous 3 jours ; le délai de livraison dépend ensuite de la destination et du transporteur. La livraison est offerte dès 150 € d'achat en France. Vous pouvez aussi choisir le retrait gratuit en boutique, au 8 rue des Écouffes. Les frais et délais exacts s'affichent au moment de la commande selon la destination.",
      en: 'We ship worldwide. Your order is dispatched within 3 days; delivery time then depends on the destination and the carrier. Shipping is free over €150 in France. You can also choose free in-store pickup at 8 rue des Écouffes. Exact costs and times are shown at checkout depending on the destination.',
    },
  },
  {
    q: {
      fr: 'Puis-je retourner ou échanger un article ?',
      en: 'Can I return or exchange an item?',
    },
    a: {
      fr: "Oui, selon nos conditions de retour. Chaque pièce étant unique, l'échange dépend de la disponibilité. Retrouvez toutes les modalités sur notre page Retours, ou contactez-nous à nouvelleriveparis@gmail.com.",
      en: 'Yes, according to our return conditions. As every piece is unique, exchanges depend on availability. Find all the details on our Returns page, or contact us at nouvelleriveparis@gmail.com.',
    },
  },
  {
    q: {
      fr: 'Comment postuler ou rejoindre l\'équipe de Nouvelle Rive ?',
      en: 'How can I apply or join the Nouvelle Rive team?',
    },
    a: {
      fr: "Pour postuler chez Nouvelle Rive, envoyez-nous un DM sur Instagram @nouvellerive avec quelques mots sur vous et ce qui vous motive. C'est le moyen le plus direct pour nous joindre côté recrutement.",
      en: "To apply at Nouvelle Rive, send us a DM on Instagram @nouvellerive with a few words about yourself and what motivates you. It's the most direct way to reach us about joining the team.",
    },
    link: { href: 'https://www.instagram.com/nouvellerive', fr: 'Nous écrire sur Instagram →', en: 'Message us on Instagram →' },
  },
  {
    q: {
      fr: 'Puis-je réserver une pièce et la récupérer en boutique ?',
      en: 'Can I reserve a piece and pick it up in store?',
    },
    a: {
      fr: "Oui. Vous pouvez commander en ligne et choisir le retrait gratuit en boutique. Pour réserver une pièce vue en ligne ou sur nos réseaux, écrivez-nous sur Instagram @nouvellerive ou par email — attention, les pièces étant uniques, elles partent vite.",
      en: 'Yes. You can order online and choose free in-store pickup. To hold a piece you saw online or on our social media, message us on Instagram @nouvellerive or by email — but note that pieces are unique and sell fast.',
    },
  },
]

function stripForSchema(s: string) {
  return s.replace(/\s+/g, ' ').trim()
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((item) => ({
    '@type': 'Question',
    name: stripForSchema(item.q.fr),
    acceptedAnswer: {
      '@type': 'Answer',
      text: stripForSchema(item.a.fr),
    },
  })),
}

export default function FaqPage() {
  const lang = useLang()
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <main className="min-h-screen bg-white">
        {/* Hero */}
        <div className="px-6 py-20">
          <h1
            id="titre"
            style={{
              fontSize: 'clamp(40px, 8vw, 120px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: '0.9',
              textTransform: 'uppercase',
            }}
          >
            FAQ
          </h1>
          <p
            className="mt-6 uppercase font-semibold"
            style={{ fontSize: 'clamp(11px, 1.2vw, 13px)', letterSpacing: '0.04em', color: bleuElectrique }}
          >
            {t('Questions fréquentes', 'Frequently asked questions', lang)}
          </p>
        </div>

        <div className="w-full border-t border-black" />

        {/* Liste FAQ */}
        <div className="max-w-3xl mx-auto px-6 py-4">
          {FAQ.map((item, i) => {
            const isOpen = openIndex === i
            return (
              <div key={i} className="border-b border-black">
                <button
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="w-full flex items-start justify-between gap-6 py-6 text-left"
                  aria-expanded={isOpen}
                >
                  <span style={{ fontSize: '18px', fontWeight: 600, lineHeight: 1.3 }}>
                    {t(item.q.fr, item.q.en, lang)}
                  </span>
                  <span
                    aria-hidden
                    style={{ fontSize: '22px', lineHeight: 1, color: bleuElectrique, flexShrink: 0 }}
                  >
                    {isOpen ? '–' : '+'}
                  </span>
                </button>
                {isOpen && (
                  <div className="pb-6">
                    <p style={{ fontSize: '16px', lineHeight: 1.6, color: '#222' }}>
                      {t(item.a.fr, item.a.en, lang)}
                    </p>
                    {item.link && (
                      <a
                        href={item.link.href}
                        {...(item.link.href.startsWith('http')
                          ? { target: '_blank', rel: 'noopener noreferrer' }
                          : {})}
                        className="inline-block mt-4"
                        style={{ fontSize: '14px', fontWeight: 600, color: bleuElectrique }}
                      >
                        {t(item.link.fr, item.link.en, lang)}
                      </a>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* CTA contact */}
        <div className="max-w-3xl mx-auto px-6 py-12">
          <p style={{ fontSize: '16px', lineHeight: 1.6 }}>
            {t(
              'Une autre question ? Écrivez-nous à ',
              'Another question? Email us at ',
              lang
            )}
            <a href="mailto:nouvelleriveparis@gmail.com" style={{ color: bleuElectrique, fontWeight: 600 }}>
              nouvelleriveparis@gmail.com
            </a>
            {t(' ou sur Instagram ', ' or on Instagram ', lang)}
            <a
              href="https://www.instagram.com/nouvellerive"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: bleuElectrique, fontWeight: 600 }}
            >
              @nouvellerive
            </a>
            .
          </p>
          <a
            href="/boutique"
            className="inline-block mt-8 py-4 px-8 text-white transition-opacity hover:opacity-80"
            style={{ backgroundColor: bleuElectrique, fontSize: '11px', letterSpacing: '0.2em', fontWeight: 600 }}
          >
            {t('DÉCOUVRIR LA BOUTIQUE', 'DISCOVER THE SHOP', lang)}
          </a>
        </div>
      </main>

      <footer className="border-t border-black py-8 text-center">
        <p style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#999' }}>
          NOUVELLE RIVE — 8 RUE DES ECOUFFES, PARIS
        </p>
      </footer>
    </div>
  )
}
