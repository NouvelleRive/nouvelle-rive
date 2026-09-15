// lib/emails/commandes.ts
// Emails transactionnels ENVOYÉS AU CLIENT pour une commande en ligne (site).
// Réutilise Resend + le style de marque (cf. lib/emails/ateliers.ts).
// Bilingue : la langue est déduite du pays de l'adresse (FR/MC → français, sinon anglais),
// français par défaut si pas d'adresse (retrait boutique).
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'Nouvelle Rive <noreply@nouvellerive.eu>'
const OWNER = 'nouvelleriveparis@gmail.com'

export type Lang = 'fr' | 'en'

// Pays considérés francophones par défaut (les multilingues type BE/CH → anglais, plus sûr).
const FR_COUNTRIES = new Set(['FR', 'MC'])

export function langFromPays(paysCode?: string | null): Lang {
  if (!paysCode) return 'fr'
  return FR_COUNTRIES.has(String(paysCode).toUpperCase()) ? 'fr' : 'en'
}

// Sélecteur fr/en
const pick = (lang: Lang, fr: string, en: string) => (lang === 'en' ? en : fr)

// Signature de marque commune à tous les mails (identique fr/en).
// Logos site / Instagram / TikTok en images (public/social/*.png) — JAMAIS le mot
// "Instagram" en toutes lettres. Mails = noreply : on n'invite JAMAIS à répondre.
const SIGNATURE = `
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #000;font-size:12px;line-height:1.7;color:#000;">
    <p style="margin:0;font-weight:600;letter-spacing:2px;">NOUVELLE RIVE</p>
    <p style="margin:12px 0;">
      <a href="https://www.nouvellerive.eu" style="text-decoration:none;"><img src="https://www.nouvellerive.eu/social/web.png" width="24" height="24" alt="nouvellerive.eu" style="display:inline-block;margin-right:16px;vertical-align:middle;border:0;" /></a>
      <a href="https://instagram.com/nouvellerive" style="text-decoration:none;"><img src="https://www.nouvellerive.eu/social/instagram.png" width="24" height="24" alt="@nouvellerive" style="display:inline-block;margin-right:16px;vertical-align:middle;border:0;" /></a>
      <a href="https://www.tiktok.com/@nouvelle.rive" style="text-decoration:none;"><img src="https://www.nouvellerive.eu/social/tiktok.png" width="24" height="24" alt="@nouvelle.rive" style="display:inline-block;vertical-align:middle;border:0;" /></a>
    </p>
    <p style="margin:2px 0 0 0;">8 rue des Écouffes, 75004 Paris — Le Marais</p>
    <p style="margin:8px 0 0 0;font-style:italic;">Vintage is the new new</p>
  </div>
`

export type ArticleCommande = {
  nom?: string | null
  sku?: string | null
  marque?: string | null
  prix?: number | null
  image?: string | null
}

// Enveloppe HTML commune (une seule source pour tous les mails commande)
function layout(titre: string, contenu: string, lang: Lang) {
  return `
    <div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#000;">
      <h2 style="font-size:18px;font-weight:normal;letter-spacing:2px;border-bottom:1px solid #000;padding-bottom:16px;">
        ${titre}
      </h2>
      ${contenu}
      <p style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#666;">
        ${pick(lang, "L'équipe Nouvelle Rive", 'The Nouvelle Rive team')}
      </p>
      ${SIGNATURE}
    </div>
  `
}

function articlesHtml(articles: ArticleCommande[], lang: Lang) {
  return articles.map(a => `
    <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #eee;">
      ${a.image ? `<img src="${a.image}" alt="" width="60" height="60" style="width:60px;height:60px;object-fit:cover;border:1px solid #eee;" />` : ''}
      <div>
        ${a.marque ? `<p style="margin:0;font-size:11px;letter-spacing:1px;color:#999;">${String(a.marque).toUpperCase()}</p>` : ''}
        <p style="margin:2px 0 0 0;font-size:14px;">${a.nom || a.sku || pick(lang, 'Article', 'Item')}</p>
        ${a.prix != null ? `<p style="margin:4px 0 0 0;font-size:14px;">${Number(a.prix).toFixed(2)} €</p>` : ''}
      </div>
    </div>
  `).join('')
}

// 1) Confirmation de commande (déclenchée au paiement, depuis le webhook Square)
export async function sendConfirmationCommande(params: {
  email: string
  prenom: string
  nom?: string
  telephone?: string | null
  articles: ArticleCommande[]
  modeLivraison: string | null
  adresse: any
  total?: number
  lang?: Lang
}) {
  const { email, prenom, nom, telephone, articles, modeLivraison, adresse, total } = params
  const lang = params.lang || langFromPays(adresse?.paysCode)
  const livraison = modeLivraison === 'livraison'

  // Récap des infos saisies par la cliente → lui permet de repérer une erreur
  // (adresse, téléphone, email) tant que la commande n'est pas encore partie.
  const contactRecap = `
    <div style="margin:24px 0;padding:16px;border:1px solid #000;">
      <p style="margin:0 0 8px 0;font-size:11px;letter-spacing:1px;color:#666;">
        ${pick(lang, 'VÉRIFIEZ VOS INFORMATIONS', 'CHECK YOUR DETAILS')}
      </p>
      <p style="margin:0;font-size:14px;line-height:1.6;">
        <strong>${[prenom, nom].filter(Boolean).join(' ')}</strong><br>
        ${email}<br>
        ${telephone ? `${telephone}<br>` : ''}
        ${livraison && adresse ? `
          <br>${pick(lang, 'Adresse de livraison', 'Delivery address')} :<br>
          ${adresse.adresse || adresse.rue || ''}<br>
          ${adresse.codePostal || ''} ${adresse.ville || ''}<br>
          ${adresse.pays || ''}
        ` : ''}
      </p>
      <p style="margin:12px 0 0 0;font-size:12px;color:#666;">
        ${pick(lang,
          'Une erreur ? Écrivez-nous en message privé au plus vite, avant l\'expédition.',
          'Spotted a mistake? Send us a DM as soon as possible, before shipping.')}
      </p>
    </div>
  `

  const contenu = `
    <p style="margin:24px 0;">${pick(lang, `Bonjour ${prenom || ''},`, `Hello ${prenom || ''},`)}<br><br>
      ${pick(lang,
        "Merci pour votre commande — nous l'avons bien reçue et la préparons.",
        'Thank you for your order — we have received it and are preparing it.')}
    </p>
    <div style="margin:24px 0;">${articlesHtml(articles, lang)}</div>
    ${total != null ? `<p style="margin:8px 0;font-size:16px;"><strong>${pick(lang, 'Total', 'Total')} : ${Number(total).toFixed(2)} €</strong></p>` : ''}
    <div style="margin:24px 0;padding:16px;background:#f9f9f9;">
      <p style="margin:0;font-size:14px;">
        ${livraison
          ? `📦 <strong>${pick(lang, 'Livraison à domicile', 'Home delivery')}</strong><br>${pick(lang, "Vous recevrez un email avec le numéro de suivi dès l'expédition.", 'You will receive an email with the tracking number as soon as it ships.')}`
          : `🏪 <strong>${pick(lang, 'Retrait en boutique', 'In-store pickup')}</strong><br>8 rue des Écouffes, 75004 Paris<br>${pick(lang, 'Vous recevrez un email dès que votre commande sera prête.', 'You will receive an email as soon as your order is ready.')}`}
      </p>
    </div>
    ${contactRecap}
  `
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      bcc: OWNER, // Nouvelle Rive en copie cachée pour suivre (à retirer plus tard si besoin)
      subject: pick(lang, 'Votre commande Nouvelle Rive est confirmée', 'Your Nouvelle Rive order is confirmed'),
      html: layout(pick(lang, 'VOTRE COMMANDE EST CONFIRMÉE', 'YOUR ORDER IS CONFIRMED'), contenu, lang),
    })
    return { success: true }
  } catch (error) {
    console.error('[EMAIL] confirmation commande KO:', error)
    return { success: false, error }
  }
}

// 2) Confirmation d'envoi (déclenchée au clic "Postée", suivi obligatoire)
export async function sendConfirmationEnvoi(params: {
  email: string
  prenom: string
  articles: ArticleCommande[]
  numeroSuivi: string
  transporteur?: string | null
  lang?: Lang
}) {
  const { email, prenom, articles, numeroSuivi, transporteur, lang = 'fr' } = params
  const contenu = `
    <p style="margin:24px 0;">${pick(lang, `Bonjour ${prenom || ''},`, `Hello ${prenom || ''},`)}<br><br>
      ${pick(lang,
        "Bonne nouvelle : votre commande vient d'être expédiée. 💙🦋",
        'Good news: your order has just shipped. 💙🦋')}
    </p>
    <div style="margin:24px 0;">${articlesHtml(articles, lang)}</div>
    <div style="margin:24px 0;padding:16px;border:1px solid #000;">
      <p style="margin:0 0 8px 0;"><strong>${pick(lang, 'Transporteur', 'Carrier')} :</strong> ${transporteur || '—'}</p>
      <p style="margin:0;"><strong>${pick(lang, 'Numéro de suivi', 'Tracking number')} :</strong> ${numeroSuivi}</p>
    </div>
  `
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      bcc: OWNER,
      subject: pick(lang, 'Votre commande Nouvelle Rive a été expédiée', 'Your Nouvelle Rive order has shipped'),
      html: layout(pick(lang, 'VOTRE COMMANDE EST EN ROUTE', 'YOUR ORDER IS ON ITS WAY'), contenu, lang),
    })
    return { success: true }
  } catch (error) {
    console.error('[EMAIL] confirmation envoi KO:', error)
    return { success: false, error }
  }
}

// 3) Retrait prêt (déclenché au clic "Préparée" pour une commande en retrait boutique)
export async function sendRetraitPret(params: {
  email: string
  prenom: string
  articles: ArticleCommande[]
  lang?: Lang
}) {
  const { email, prenom, articles, lang = 'fr' } = params
  const contenu = `
    <p style="margin:24px 0;">${pick(lang, `Bonjour ${prenom || ''},`, `Hello ${prenom || ''},`)}<br><br>
      ${pick(lang, 'Votre commande vous attend en boutique.', 'Your order is waiting for you in store.')}
    </p>
    <div style="margin:24px 0;">${articlesHtml(articles, lang)}</div>
    <div style="margin:24px 0;padding:16px;background:#f9f9f9;">
      <p style="margin:0;font-size:14px;">🏪 <strong>Nouvelle Rive</strong><br>8 rue des Écouffes, 75004 Paris</p>
    </div>
  `
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      bcc: OWNER,
      subject: pick(lang, 'Votre commande Nouvelle Rive est prête', 'Your Nouvelle Rive order is ready'),
      html: layout(pick(lang, 'VOTRE COMMANDE VOUS ATTEND', 'YOUR ORDER IS WAITING'), contenu, lang),
    })
    return { success: true }
  } catch (error) {
    console.error('[EMAIL] retrait prêt KO:', error)
    return { success: false, error }
  }
}

// 3b) Retrait confirmé (déclenché au clic "Récupérée" — le client est venu chercher)
export async function sendRetraitConfirme(params: {
  email: string
  prenom: string
  articles: ArticleCommande[]
  lang?: Lang
}) {
  const { email, prenom, articles, lang = 'fr' } = params
  const contenu = `
    <p style="margin:24px 0;">${pick(lang, `Bonjour ${prenom || ''},`, `Hello ${prenom || ''},`)}<br><br>
      ${pick(lang,
        "Merci d'être passé·e ! Nous confirmons le retrait de votre commande en boutique.",
        'Thank you for stopping by! We confirm the in-store pickup of your order.')}
    </p>
    <div style="margin:24px 0;">${articlesHtml(articles, lang)}</div>
    <p style="margin:24px 0;">${pick(lang, 'On espère que votre pièce vous plaît.', 'We hope you love your piece.')}</p>
  `
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      bcc: OWNER,
      subject: pick(lang, 'Votre retrait en boutique est confirmé', 'Your in-store pickup is confirmed'),
      html: layout(pick(lang, 'RETRAIT CONFIRMÉ', 'PICKUP CONFIRMED'), contenu, lang),
    })
    return { success: true }
  } catch (error) {
    console.error('[EMAIL] retrait confirmé KO:', error)
    return { success: false, error }
  }
}

// 3c) Panier oublié — relance douce après un checkout non payé.
// relance 1 (~1h) : rappel simple, la pièce est encore là.
// relance 2 (~24h) : réassurance + rareté (pièce unique). Jamais de code promo
// (dévalorise la marque et entraîne l'abandon volontaire) — on joue la rareté.
// Le lien pointe vers la FICHE PRODUIT (pas le lien Square) : le re-checkout
// revalide la dispo côté serveur → aucune revente d'une pièce déjà partie.
const BASE_URL = 'https://www.nouvellerive.eu'

// Articles cliquables : chaque carte renvoie vers sa fiche /boutique/{id}.
function articlesHtmlLies(articles: (ArticleCommande & { id?: string | null })[], lang: Lang) {
  return articles.map(a => {
    const inner = `
      <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #eee;">
        ${a.image ? `<img src="${a.image}" alt="" width="60" height="60" style="width:60px;height:60px;object-fit:cover;border:1px solid #eee;" />` : ''}
        <div>
          ${a.marque ? `<p style="margin:0;font-size:11px;letter-spacing:1px;color:#999;">${String(a.marque).toUpperCase()}</p>` : ''}
          <p style="margin:2px 0 0 0;font-size:14px;">${a.nom || a.sku || pick(lang, 'Article', 'Item')}</p>
          ${a.prix != null ? `<p style="margin:4px 0 0 0;font-size:14px;">${Number(a.prix).toFixed(2)} €</p>` : ''}
        </div>
      </div>`
    return a.id
      ? `<a href="${BASE_URL}/boutique/${a.id}" style="text-decoration:none;color:#000;display:block;">${inner}</a>`
      : inner
  }).join('')
}

export async function sendPanierOublie(params: {
  email: string
  prenom: string
  articles: (ArticleCommande & { id?: string | null })[]
  relance: 1 | 2
  lang?: Lang
}) {
  const { email, prenom, articles, relance, lang = 'fr' } = params
  if (articles.length === 0) return { success: false, error: 'no articles' }
  const uneSeule = articles.length === 1
  // CTA : fiche produit si une seule pièce, sinon la boutique.
  const ctaUrl = uneSeule && articles[0].id ? `${BASE_URL}/boutique/${articles[0].id}` : `${BASE_URL}/boutique`
  const ctaLabel = uneSeule
    ? pick(lang, 'Finaliser ma commande', 'Complete my order')
    : pick(lang, 'Revoir mes pièces', 'See my pieces')

  const intro = relance === 1
    ? pick(lang,
        uneSeule
          ? "Votre pièce vous attend — vous n'avez pas finalisé votre commande."
          : "Vos pièces vous attendent — vous n'avez pas finalisé votre commande.",
        uneSeule
          ? "Your piece is waiting — you haven't completed your order."
          : "Your pieces are waiting — you haven't completed your order.")
    : pick(lang,
        uneSeule
          ? "Votre pièce est toujours disponible, mais elle est unique : une seule est en stock."
          : "Vos pièces sont toujours disponibles, mais elles sont uniques : une seule de chaque en stock.",
        uneSeule
          ? "Your piece is still available, but it is unique: only one is in stock."
          : "Your pieces are still available, but they are unique: only one of each in stock.")

  const reassurance = relance === 2
    ? `<div style="margin:24px 0;padding:16px;background:#f9f9f9;">
         <p style="margin:0;font-size:13px;line-height:1.7;">
           ${pick(lang,
             '💳 Paiement 100% sécurisé · 🏪 Retrait en boutique ou 📦 livraison partout · 💙 Une équipe qui vous répond',
             '💳 100% secure payment · 🏪 In-store pickup or 📦 delivery anywhere · 💙 A team that replies to you')}
         </p>
       </div>`
    : ''

  const contenu = `
    <p style="margin:24px 0;">${pick(lang, `Bonjour ${prenom || ''},`, `Hello ${prenom || ''},`)}<br><br>
      ${intro}
    </p>
    <div style="margin:24px 0;">${articlesHtmlLies(articles, lang)}</div>
    <div style="text-align:center;margin:28px 0;">
      <a href="${ctaUrl}" style="display:inline-block;background:#000;color:#fff;padding:14px 28px;text-decoration:none;font-size:13px;letter-spacing:1px;">
        ${ctaLabel}
      </a>
    </div>
    ${reassurance}
  `
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      bcc: OWNER,
      subject: relance === 1
        ? pick(lang, uneSeule ? 'Votre pièce vous attend 💙' : 'Vos pièces vous attendent 💙',
                     uneSeule ? 'Your piece is waiting 💙' : 'Your pieces are waiting 💙')
        : pick(lang, uneSeule ? 'Encore disponible — mais elle est unique 🌊' : 'Encore disponibles — mais uniques 🌊',
                     uneSeule ? 'Still available — but it is unique 🌊' : 'Still available — but unique 🌊'),
      html: layout(
        relance === 1
          ? pick(lang, uneSeule ? 'VOTRE PIÈCE VOUS ATTEND' : 'VOS PIÈCES VOUS ATTENDENT',
                       uneSeule ? 'YOUR PIECE IS WAITING' : 'YOUR PIECES ARE WAITING')
          : pick(lang, 'PIÈCE UNIQUE, ENCORE LÀ', 'UNIQUE PIECE, STILL HERE'),
        contenu, lang),
    })
    return { success: true }
  } catch (error) {
    console.error('[EMAIL] panier oublié KO:', error)
    return { success: false, error }
  }
}
