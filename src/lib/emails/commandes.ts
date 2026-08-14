// lib/emails/commandes.ts
// Emails transactionnels ENVOYÉS AU CLIENT pour une commande en ligne (site).
// Réutilise Resend + le style de marque (cf. lib/emails/ateliers.ts).
// NB : le contenu / design est volontairement simple pour l'instant — la logique
// (destinataires, données, déclencheurs) est en place, on peaufinera le rendu ensuite.
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'Nouvelle Rive <noreply@nouvellerive.eu>'
const OWNER = 'nouvelleriveparis@gmail.com'

export type ArticleCommande = {
  nom?: string | null
  sku?: string | null
  marque?: string | null
  prix?: number | null
  image?: string | null
}

// Enveloppe HTML commune (une seule source pour tous les mails commande)
function layout(titre: string, contenu: string) {
  return `
    <div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#000;">
      <h2 style="font-size:18px;font-weight:normal;letter-spacing:2px;border-bottom:1px solid #000;padding-bottom:16px;">
        ${titre}
      </h2>
      ${contenu}
      <p style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#666;">
        Une question ? Répondez directement à cet email.<br><br>
        L'équipe Nouvelle Rive
      </p>
    </div>
  `
}

function articlesHtml(articles: ArticleCommande[]) {
  return articles.map(a => `
    <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #eee;">
      ${a.image ? `<img src="${a.image}" alt="" width="60" height="60" style="width:60px;height:60px;object-fit:cover;border:1px solid #eee;" />` : ''}
      <div>
        ${a.marque ? `<p style="margin:0;font-size:11px;letter-spacing:1px;color:#999;">${String(a.marque).toUpperCase()}</p>` : ''}
        <p style="margin:2px 0 0 0;font-size:14px;">${a.nom || a.sku || 'Article'}</p>
        ${a.prix != null ? `<p style="margin:4px 0 0 0;font-size:14px;">${Number(a.prix).toFixed(2)} €</p>` : ''}
      </div>
    </div>
  `).join('')
}

// 1) Confirmation de commande (déclenchée au paiement, depuis le webhook Square)
export async function sendConfirmationCommande(params: {
  email: string
  prenom: string
  articles: ArticleCommande[]
  modeLivraison: string | null
  adresse: any
  total?: number
}) {
  const { email, prenom, articles, modeLivraison, adresse, total } = params
  const livraison = modeLivraison === 'livraison'
  const contenu = `
    <p style="margin:24px 0;">Bonjour ${prenom || ''},<br><br>
      Merci pour votre commande — nous l'avons bien reçue et la préparons.
    </p>
    <div style="margin:24px 0;">${articlesHtml(articles)}</div>
    ${total != null ? `<p style="margin:8px 0;font-size:16px;"><strong>Total : ${Number(total).toFixed(2)} €</strong></p>` : ''}
    <div style="margin:24px 0;padding:16px;background:#f9f9f9;">
      <p style="margin:0;font-size:14px;">
        ${livraison
          ? `📦 <strong>Livraison à domicile</strong><br>${adresse ? `${adresse.adresse || adresse.rue || ''}, ${adresse.codePostal || ''} ${adresse.ville || ''} — ${adresse.pays || ''}` : ''}<br>Vous recevrez un email avec le numéro de suivi dès l'expédition.`
          : `🏪 <strong>Retrait en boutique</strong><br>8 rue des Écouffes, 75004 Paris<br>Vous recevrez un email dès que votre commande sera prête.`}
      </p>
    </div>
  `
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Votre commande Nouvelle Rive est confirmée',
      html: layout('VOTRE COMMANDE EST CONFIRMÉE', contenu),
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
}) {
  const { email, prenom, articles, numeroSuivi, transporteur } = params
  const contenu = `
    <p style="margin:24px 0;">Bonjour ${prenom || ''},<br><br>
      Bonne nouvelle : votre commande vient d'être expédiée.
    </p>
    <div style="margin:24px 0;">${articlesHtml(articles)}</div>
    <div style="margin:24px 0;padding:16px;border:1px solid #000;">
      <p style="margin:0 0 8px 0;"><strong>Transporteur :</strong> ${transporteur || '—'}</p>
      <p style="margin:0;"><strong>Numéro de suivi :</strong> ${numeroSuivi}</p>
    </div>
  `
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Votre commande Nouvelle Rive a été expédiée',
      html: layout('VOTRE COMMANDE EST EN ROUTE', contenu),
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
}) {
  const { email, prenom, articles } = params
  const contenu = `
    <p style="margin:24px 0;">Bonjour ${prenom || ''},<br><br>
      Votre commande vous attend en boutique.
    </p>
    <div style="margin:24px 0;">${articlesHtml(articles)}</div>
    <div style="margin:24px 0;padding:16px;background:#f9f9f9;">
      <p style="margin:0;font-size:14px;">🏪 <strong>Nouvelle Rive</strong><br>8 rue des Écouffes, 75004 Paris</p>
    </div>
  `
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Votre commande Nouvelle Rive est prête',
      html: layout('VOTRE COMMANDE VOUS ATTEND', contenu),
    })
    return { success: true }
  } catch (error) {
    console.error('[EMAIL] retrait prêt KO:', error)
    return { success: false, error }
  }
}

// 4) Catch-up (10 jours après expédition/retrait) — relance douce
export async function sendCatchupCommande(params: {
  email: string
  prenom: string
}) {
  const { email, prenom } = params
  const contenu = `
    <p style="margin:24px 0;">Bonjour ${prenom || ''},<br><br>
      Nous espérons que votre pièce vous plaît.<br><br>
      Recherchez-vous quelque chose en particulier ? Dites-nous ce qui vous ferait plaisir
      (marque, type de pièce, taille) et nous ouvrons l'œil pour vous.
    </p>
  `
  try {
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Une pièce en tête ? On chine pour vous',
      html: layout('ON CHINE POUR VOUS', contenu),
    })
    return { success: true }
  } catch (error) {
    console.error('[EMAIL] catch-up KO:', error)
    return { success: false, error }
  }
}
