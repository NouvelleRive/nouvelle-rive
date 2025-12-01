// lib/emails/ateliers.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

// Mapping animatrice -> email
const ANIMATRICES_CONFIG: Record<string, { email: string; nom: string }> = {
  'INES PINEAU': {
    email: 'studio.inespineau@gmail.com',
    nom: 'Inès Pineau',
  },
  'TÊTE D\'ORANGE': {
    email: 'contact@tete-dorange.com',
    nom: 'Tête d\'Orange',
  },
  'ARCHIVE.S': {
    email: 'justine.salvado@gmail.com',
    nom: 'Justine (Archive.s)',
  },
  'GIGI PARIS': {
    email: 'contactgigiparis@gmail.com',
    nom: 'Gigi Paris',
  },
}

// Email de fallback si animatrice non trouvée
const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

type ReservationEmailParams = {
  nom: string
  email: string
  telephone: string
  participants: number
  date: string
  heure: string
  lieu: string
  animatrice: string
}

/**
 * Envoie un email à l'animatrice quand quelqu'un réserve
 */
export async function sendReservationEmailToAnimatrice(params: ReservationEmailParams) {
  const { nom, email, telephone, participants, date, heure, lieu, animatrice } = params
  
  const animatriceConfig = ANIMATRICES_CONFIG[animatrice]
  const toEmail = animatriceConfig?.email || ADMIN_EMAIL
  
  const dateFormatted = new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  
  const lieuNom = lieu === 'printemps' ? 'Printemps Haussmann' : 'NOUVELLE RIVE'
  
  try {
    await resend.emails.send({
      from: 'Nouvelle Rive <ateliers@nouvellerive.eu>',
      to: toEmail,
      subject: `🎨 Nouvelle réservation atelier - ${nom}`,
      html: `
        <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="font-size: 18px; font-weight: normal; letter-spacing: 2px; border-bottom: 1px solid #000; padding-bottom: 16px;">
            NOUVELLE RÉSERVATION
          </h2>
          
          <div style="margin: 24px 0; padding: 20px; border: 1px solid #000;">
            <p style="margin: 0 0 8px 0;"><strong>Créneau :</strong> ${dateFormatted} à ${heure}</p>
            <p style="margin: 0;"><strong>Lieu :</strong> ${lieuNom}</p>
          </div>
          
          <h3 style="font-size: 14px; letter-spacing: 1px; margin-top: 32px;">PARTICIPANT${participants > 1 ? 'S' : ''}</h3>
          
          <div style="margin: 16px 0; padding: 20px; background: #f9f9f9;">
            <p style="margin: 0 0 8px 0;"><strong>Nom :</strong> ${nom}</p>
            <p style="margin: 0 0 8px 0;"><strong>Email :</strong> <a href="mailto:${email}">${email}</a></p>
            <p style="margin: 0 0 8px 0;"><strong>Téléphone :</strong> <a href="tel:${telephone}">${telephone}</a></p>
            <p style="margin: 0;"><strong>Nombre :</strong> ${participants} personne${participants > 1 ? 's' : ''}</p>
          </div>
          
          <div style="margin-top: 24px; padding: 16px; background: #e8f5e9; border-left: 4px solid #4caf50;">
            <p style="margin: 0; font-size: 14px;">
              ✓ Acompte de <strong>${participants * 20}€</strong> payé
            </p>
          </div>
          
          <p style="margin-top: 32px; font-size: 12px; color: #666;">
            Retrouve toutes tes réservations sur ton espace 
            <a href="https://nouvellerive.eu/chineuse/ateliers" style="color: #000;">Nouvelle Rive</a>
          </p>
        </div>
      `,
    })
    
    console.log(`[EMAIL] Notification envoyée à ${toEmail} pour réservation de ${nom}`)
    return { success: true }
  } catch (error) {
    console.error('[EMAIL] Erreur envoi notification animatrice:', error)
    return { success: false, error }
  }
}

/**
 * Envoie un email de confirmation au client
 */
export async function sendConfirmationEmailToClient(params: ReservationEmailParams) {
  const { nom, email, participants, date, heure, lieu, animatrice } = params
  
  const dateFormatted = new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  
  const lieuNom = lieu === 'printemps' ? 'Printemps Haussmann' : 'NOUVELLE RIVE'
  const lieuAdresse = lieu === 'printemps' 
    ? '64 Boulevard Haussmann, 75009 Paris (7ᵉ étage, sous la coupole Binet)'
    : '8 rue des Écouffes, 75004 Paris'
  
  const animatriceNom = ANIMATRICES_CONFIG[animatrice]?.nom || animatrice
  
  try {
    await resend.emails.send({
      from: 'Nouvelle Rive <ateliers@nouvellerive.eu>',
      to: email,
      subject: `Confirmation de votre atelier bijou - ${dateFormatted}`,
      html: `
        <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="font-size: 18px; font-weight: normal; letter-spacing: 2px; border-bottom: 1px solid #000; padding-bottom: 16px;">
            VOTRE RÉSERVATION EST CONFIRMÉE
          </h2>
          
          <p style="margin: 24px 0;">
            Bonjour ${nom},<br><br>
            Votre atelier de création de bijoux upcyclés est confirmé !
          </p>
          
          <div style="margin: 24px 0; padding: 20px; border: 1px solid #000;">
            <p style="margin: 0 0 12px 0;"><strong>📅 Date :</strong> ${dateFormatted} à ${heure}</p>
            <p style="margin: 0 0 12px 0;"><strong>📍 Lieu :</strong> ${lieuNom}</p>
            <p style="margin: 0 0 12px 0; font-size: 14px; color: #666; padding-left: 24px;">${lieuAdresse}</p>
            <p style="margin: 0 0 12px 0;"><strong>👩‍🎨 Animatrice :</strong> ${animatriceNom}</p>
            <p style="margin: 0;"><strong>👥 Participants :</strong> ${participants} personne${participants > 1 ? 's' : ''}</p>
          </div>
          
          <div style="margin: 24px 0; padding: 16px; background: #f9f9f9;">
            <p style="margin: 0; font-size: 14px;">
              <strong>Acompte payé :</strong> ${participants * 20}€<br>
              <span style="color: #666; font-size: 12px;">Ce montant sera déduit du prix final de votre bijou</span>
            </p>
          </div>
          
          <h3 style="font-size: 14px; letter-spacing: 1px; margin-top: 32px;">CE QUI VOUS ATTEND</h3>
          
          <ul style="margin: 16px 0; padding-left: 20px; color: #333; line-height: 1.8;">
            <li>Un starter pack avec tout le matériel nécessaire</li>
            <li>Une sélection de breloques et pierres (1 à 40€)</li>
            <li>L'accompagnement d'une créatrice bijoux</li>
            <li>Repartez avec votre création unique !</li>
          </ul>
          
          <p style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
            Une question ? Répondez directement à cet email.<br>
            À très vite !<br><br>
            L'équipe Nouvelle Rive
          </p>
        </div>
      `,
    })
    
    console.log(`[EMAIL] Confirmation envoyée à ${email}`)
    return { success: true }
  } catch (error) {
    console.error('[EMAIL] Erreur envoi confirmation client:', error)
    return { success: false, error }
  }
}