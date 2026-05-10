// Renvoie l'email de confirmation de RDV à Hina
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { Resend } from 'resend'
import dotenv from 'dotenv'
dotenv.config({ path: new URL('../.env.local', import.meta.url).pathname })

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const resend = new Resend(process.env.RESEND_API_KEY)

function frenchDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const monthKey = '2026-05'
const slotKey = '2026-05-09_13h'

const r = await db.collection('restocks').doc(monthKey).get()
const slot = r.data().slots[slotKey]
const dep = (await db.collection('deposante').where('trigramme', '==', slot.trigramme).limit(1).get()).docs[0].data()

const [dateStr, creneau] = slotKey.split('_')
const jour = frenchDate(dateStr)

let piecesHtml = ''
if (slot.pieceIds?.length) {
  const piecesData = []
  for (const id of slot.pieceIds) {
    const ps = await db.collection('produits').doc(id).get()
    if (ps.exists) piecesData.push({ id: ps.id, ...ps.data() })
  }
  if (piecesData.length) {
    const rows = piecesData.map(p => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;width:80px;">
          ${p.imageUrl ? `<img src="${p.imageUrl}" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:4px;display:block;" />` : ''}
        </td>
        <td style="padding:8px;border-bottom:1px solid #eee;font-size:13px;">
          <strong>${p.sku || ''}</strong> ${(p.nom || '').replace(`${p.sku} - `, '')}<br/>
          <span style="color:#888;font-size:11px;">${(p.categorie || '').replace('DEP - ', '')} · ${p.prix || ''}€</span>
        </td>
      </tr>`).join('')
    piecesHtml = `<p style="margin-top:24px;font-weight:600;">Pièces à apporter :</p><table style="width:100%;border-collapse:collapse;margin-top:8px;">${rows}</table>`
  }
}

const result = await resend.emails.send({
  from: 'Nouvelle Rive <noreply@nouvellerive.eu>',
  to: dep.email,
  bcc: 'nouvelleriveparis@gmail.com',
  subject: `Rendez-vous confirmé — ${jour} à ${creneau} 💙`,
  html: `
    <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#000;">
      <h1 style="color:#22209C;">Rendez-vous confirmé 💙</h1>
      <p>Bonjour ${dep.prenom || ''},</p>
      <p>Nous vous attendons en boutique pour votre dépôt :</p>
      <p style="font-size:18px;font-weight:bold;">${jour}<br/>à <span style="color:#22209C;">${creneau}</span></p>
      <p>Adresse : <strong>8 rue des Écouffes, 75004 Paris</strong></p>
      ${piecesHtml}
      <p style="font-size:12px;color:#888;margin-top:32px;">À très bientôt 🌊</p>
    </div>
  `,
})
console.log('Email envoyé à', dep.email, '- résultat:', JSON.stringify(result))
process.exit(0)
