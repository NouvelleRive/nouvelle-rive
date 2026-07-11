// app/api/cron/reminders/route.ts
// Endpoint déclenché par Vercel Cron.
// Vérifie l'heure de Paris et envoie les notifs au tel boutique :
// - 11h50 : rappel pointage arrivée si vendeuse(s) sur planning du jour pas encore pointée(s)
// - 12h50 / 15h50 / 17h50 : "[Nom] arrive dans 10 min" pour restock 13h / 16h / 18h
// - 19h55 : rappel pointage départ si pas pointé
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
import { FieldValue } from 'firebase-admin/firestore'
import { sendPushToOwner } from '@/lib/webpush'
import { Resend } from 'resend'

const CRON_SECRET = process.env.CRON_SECRET
const resend = new Resend(process.env.RESEND_API_KEY)

// Renvoie {h, m} en heure de Paris (gère CET/CEST automatiquement)
function parisHM(): { h: number; m: number; dateStr: string } {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(now)
  const get = (t: string) => parts.find(p => p.type === t)?.value || ''
  const h = parseInt(get('hour'), 10)
  const m = parseInt(get('minute'), 10)
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`
  return { h, m, dateStr }
}

// Fenêtre de 5 min autour d'un horaire cible (pour tolérer le timing du cron)
function inWindow(h: number, m: number, targetH: number, targetM: number): boolean {
  const cur = h * 60 + m
  const t = targetH * 60 + targetM
  return Math.abs(cur - t) <= 4
}

type PieceInfo = { sku: string; nom: string; imageUrl: string; categorie: string; prix?: number; ancienPrix?: number }

// Liste les pièces "à récupérer" (pastille rouge) et "prix à baisser" (pastille orange)
// pour une chineuse donnée, évaluées à la date du restock (refDate).
// - rouge : statutRecuperation = 'aRecuperer' OU prix baissé +1 mois OU réception +3 mois
// - orange : réception entre 2 et 3 mois, jamais baissé, sans statut de récupération
async function actionsChineuse(
  trigramme: string,
  refDate: Date,
): Promise<{ aRecuperer: PieceInfo[]; prixABaisser: PieceInfo[]; stockActif: number }> {
  if (!trigramme) return { aRecuperer: [], prixABaisser: [], stockActif: 0 }
  const snap = await adminDb.collection('produits').where('trigramme', '==', trigramme.toUpperCase()).get()
  const oneMonthAgo = new Date(refDate); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
  const twoMonthsAgo = new Date(refDate); twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
  const threeMonthsAgo = new Date(refDate); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const aRecuperer: PieceInfo[] = []
  const prixABaisser: PieceInfo[] = []
  let stockActif = 0
  const toInfo = (p: any): PieceInfo => ({
    sku: p.sku || '',
    nom: (p.nom || '').replace(`${p.sku || ''} - `, ''),
    imageUrl: p.imageUrl || p.photos?.face || '',
    categorie: typeof p.categorie === 'object' ? (p.categorie?.label || '') : (p.categorie || ''),
    prix: p.prix,
    ancienPrix: p.ancienPrix,
  })
  for (const d of snap.docs) {
    const p = d.data() as any
    if (p.vendu === true) continue
    if (p.statut === 'vendu' || p.statut === 'supprime' || p.statut === 'retour') continue
    if (p.statutRecuperation === 'aRecuperer') { aRecuperer.push(toInfo(p)); continue }
    const receptionDate = p.dateReception?.toDate?.()
    // Règle absolue : réception +3 mois → rouge, peu importe la baisse
    if (receptionDate instanceof Date && receptionDate < threeMonthsAgo) {
      aRecuperer.push(toInfo(p))
      continue
    }
    const baisseDate = p.prixBaisseLe?.toDate?.()
    if (baisseDate instanceof Date) {
      if (baisseDate < oneMonthAgo) { aRecuperer.push(toInfo(p)); continue }
      if (p.recu === true) stockActif++
      continue
    }
    // Orange : réception entre 2 et 3 mois, jamais baissé
    if (receptionDate instanceof Date && receptionDate < twoMonthsAgo) prixABaisser.push(toInfo(p))
    if (p.recu === true) stockActif++
  }
  return { aRecuperer, prixABaisser, stockActif }
}

// Recherche une chineuse à partir du nom (uppercase dans les slots) ou trigramme
async function findChineuse(nom: string | undefined, trigramme?: string): Promise<{ authUid?: string; email?: string; emails?: string[]; prenom?: string; nom?: string; trigramme?: string } | null> {
  if (trigramme) {
    const snap = await adminDb.collection('chineuse').where('trigramme', '==', trigramme.toUpperCase()).limit(1).get()
    if (!snap.empty) return snap.docs[0].data() as any
  }
  if (nom) {
    const snap = await adminDb.collection('chineuse').get()
    const target = nom.toUpperCase()
    const match = snap.docs.find(d => ((d.data() as any).nom || '').toUpperCase() === target)
    if (match) return match.data() as any
  }
  return null
}

export async function GET(req: NextRequest) {
  // Vercel Cron : envoie Authorization: Bearer ${CRON_SECRET}
  const auth = req.headers.get('authorization') || ''
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }

  const { h, m, dateStr } = parisHM()
  const monthKey = dateStr.slice(0, 7)
  const actions: string[] = []

  // Rappels pointage arrivée — déclenchés 10 min après le début de chaque créneau
  // 11h10 pour slot 11-17, 12h10 pour slot 12-20.
  for (const slot of [{ name: '11-17', trigH: 11, trigM: 10 }, { name: '12-20', trigH: 12, trigM: 10 }]) {
    if (!inWindow(h, m, slot.trigH, slot.trigM)) continue
    const planningSnap = await adminDb.collection('planning').doc(monthKey).get()
    const slots = planningSnap.exists ? (planningSnap.data()?.slots || {}) : {}
    const vid = slots[`${dateStr}_${slot.name}`]
    if (!vid) continue
    const ptg = await adminDb.collection('pointages').doc(`${dateStr}_${vid}`).get()
    if (!ptg.exists || !ptg.data()?.arrivee) {
      await sendPushToOwner('boutique', {
        title: '👑 QUEEN es tu là ?',
        body: `Pointe avant de faire péter le record 🧿🍀🧧 (créneau ${slot.name})`,
        url: '/vendeuse/calendrier',
        tag: `arrivee-${slot.name}-${dateStr}`,
      })
      actions.push(`rappel-arrivee-${slot.name}`)
    }
  }

  // 12h15 — récap du jour : tâches + restocks
  if (inWindow(h, m, 12, 15)) {
    // Tâches
    const tachesSnap = await adminDb.collection('taches').doc(dateStr).get()
    const tasks: { texte: string }[] = tachesSnap.exists ? (tachesSnap.data()?.items || []) : []

    // Restocks
    const restockSnap = await adminDb.collection('restocks').doc(monthKey).get()
    const restockSlots = restockSnap.exists ? (restockSnap.data()?.slots || {}) : {}
    const restocksAujourdhui: { heure: string; nom: string }[] = []
    for (const heure of ['13h', '16h', '18h']) {
      const data = restockSlots[`${dateStr}_${heure}`]
      if (data?.nom) restocksAujourdhui.push({ heure, nom: data.nom })
    }

    if (tasks.length > 0 || restocksAujourdhui.length > 0) {
      const lignes: string[] = []
      if (restocksAujourdhui.length > 0) {
        lignes.push('📦 ' + restocksAujourdhui.map(r => `${r.nom} ${r.heure}`).join(', '))
      }
      if (tasks.length > 0) {
        lignes.push('📋 ' + tasks.map(t => t.texte).join(' · '))
      }
      await sendPushToOwner('boutique', {
        title: '☀️ Récap du jour',
        body: lignes.join(' — '),
        url: '/vendeuse/calendrier',
        tag: `recap-${dateStr}`,
      })
      actions.push('recap-jour')
    }
  }

  // 11h00 — rappel "départ pas pointé" envoyé à la vendeuse uniquement
  // les jours où elle travaille (sinon notif inutile pour celles qui n'ont pas oublié).
  // La vendeuse doit nous envoyer son horaire de départ — la correction se fait côté admin.
  if (inWindow(h, m, 11, 0)) {
    const planningSnap = await adminDb.collection('planning').doc(monthKey).get()
    const slots = planningSnap.exists ? (planningSnap.data()?.slots || {}) : {}
    const vendeusesAujourdhui = new Set<string>()
    const v1117 = slots[`${dateStr}_11-17`]
    const v1220 = slots[`${dateStr}_12-20`]
    if (v1117) vendeusesAujourdhui.add(v1117)
    if (v1220) vendeusesAujourdhui.add(v1220)

    if (vendeusesAujourdhui.size > 0) {
      const vendSnap = await adminDb.collection('vendeuses').get()
      const prenomById = new Map<string, string>()
      vendSnap.docs.forEach(d => prenomById.set(d.id, (d.data() as any).prenom || d.id))
      const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

      for (const vid of vendeusesAujourdhui) {
        const ptgSnap = await adminDb.collection('pointages').where('vendeuseId', '==', vid).get()
        const incomplete = ptgSnap.docs.filter(d => {
          const x = d.data()
          return x.date < dateStr && x.arrivee && !x.depart
        })
        if (incomplete.length === 0) continue

        const prenom = prenomById.get(vid) || vid
        for (const doc of incomplete) {
          const x = doc.data() as any
          const [, mm, dd] = (x.date as string).split('-')
          const dateLabel = `${parseInt(dd, 10)} ${monthNames[parseInt(mm, 10) - 1]}`
          await sendPushToOwner('boutique', {
            title: '⏰ Départ pas pointé',
            body: `${prenom}, envoie-nous ton heure de départ du ${dateLabel} pour qu'on ferme ta journée 💙`,
            url: '/vendeuse/calendrier',
            tag: `depart-oublie-${x.date}-${vid}`,
          })
          actions.push(`depart-oublie-${vid}-${x.date}`)
        }
      }
    }
  }

  // Rappels pointage départ — déclenchés 5 min avant la fin de chaque créneau
  // 16h55 pour slot 11-17, 19h55 pour slot 12-20.
  for (const slot of [{ name: '11-17', trigH: 16, trigM: 55 }, { name: '12-20', trigH: 19, trigM: 55 }]) {
    if (!inWindow(h, m, slot.trigH, slot.trigM)) continue
    const planningSnap = await adminDb.collection('planning').doc(monthKey).get()
    const slots = planningSnap.exists ? (planningSnap.data()?.slots || {}) : {}
    const vid = slots[`${dateStr}_${slot.name}`]
    if (!vid) continue
    const ptg = await adminDb.collection('pointages').doc(`${dateStr}_${vid}`).get()
    const x = ptg.exists ? ptg.data() : null
    if (x?.arrivee && !x?.depart) {
      await sendPushToOwner('boutique', {
        title: 'MERCI pour la journée',
        body: `N'oublie pas que t'es une 💣 (et aussi de depointer 💙)`,
        url: '/vendeuse/calendrier',
        tag: `depart-${slot.name}-${dateStr}`,
      })
      actions.push(`rappel-depart-${slot.name}`)
    }
  }

  // Restocks : 12h50 / 15h50 / 17h50 → restock à 13h / 16h / 18h
  const restockTargets = [
    { trigH: 12, trigM: 50, slot: '13h' },
    { trigH: 15, trigM: 50, slot: '16h' },
    { trigH: 17, trigM: 50, slot: '18h' },
  ]
  for (const r of restockTargets) {
    if (!inWindow(h, m, r.trigH, r.trigM)) continue
    const restockSnap = await adminDb.collection('restocks').doc(monthKey).get()
    const restockSlots = restockSnap.exists ? (restockSnap.data()?.slots || {}) : {}
    const data = restockSlots[`${dateStr}_${r.slot}`]
    if (data?.nom) {
      let bodySuffix = ''
      if (data?.type === 'chineuse') {
        const tri = (data.trigramme || '').toString().toUpperCase()
        if (tri) {
          const { aRecuperer, prixABaisser } = await actionsChineuse(tri, new Date())
          const parts: string[] = []
          if (aRecuperer.length > 0) parts.push(`${aRecuperer.length} à récupérer`)
          if (prixABaisser.length > 0) parts.push(`${prixABaisser.length} prix à baisser`)
          if (parts.length > 0) bodySuffix = ` — ${parts.join(', ')}`
        }
      }
      await sendPushToOwner('boutique', {
        title: `📦 ${data.nom} arrive dans 10 min`,
        body: `Restock prévu à ${r.slot}${bodySuffix}`,
        url: '/vendeuse/restock',
        tag: `restock-${dateStr}-${r.slot}`,
      })
      actions.push(`restock-${r.slot}`)
    }
  }

  // Rappel chineuse — 30 min avant son restock (12h30 / 15h30 / 17h30 → restock 13h / 16h / 18h)
  // Push uniquement, à la chineuse elle-même (ownerId = authUid).
  const chineuseRestockTargets = [
    { trigH: 12, trigM: 30, slot: '13h' },
    { trigH: 15, trigM: 30, slot: '16h' },
    { trigH: 17, trigM: 30, slot: '18h' },
  ]
  for (const r of chineuseRestockTargets) {
    if (!inWindow(h, m, r.trigH, r.trigM)) continue
    const restockSnap = await adminDb.collection('restocks').doc(monthKey).get()
    const restockSlots = restockSnap.exists ? (restockSnap.data()?.slots || {}) : {}
    const data = restockSlots[`${dateStr}_${r.slot}`]
    if (!data?.nom || data?.type !== 'chineuse') continue
    const chin = await findChineuse(data.nom, data.trigramme)
    if (!chin?.authUid) continue
    await sendPushToOwner(chin.authUid, {
      title: `📦 Ton restock dans 30 min`,
      body: `Rendez-vous à ${r.slot} en boutique 💙`,
      url: '/chineuse/calendrier',
      tag: `chineuse-restock-30-${dateStr}-${r.slot}`,
    })
    actions.push(`chineuse-restock-30-${r.slot}`)
  }

  // 18h00 — rappel J-1 aux déposantes dont le RDV est confirmé pour demain
  if (inWindow(h, m, 18, 0)) {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(tomorrow)
    const tomorrowMonthKey = tomorrowStr.slice(0, 7)
    const restockSnap = await adminDb.collection('restocks').doc(tomorrowMonthKey).get()
    const slots = restockSnap.exists ? (restockSnap.data()?.slots || {}) : {}
    const sentSnap = await adminDb.collection('rdvReminders').doc(tomorrowStr).get()
    const alreadySent = new Set<string>(sentSnap.exists ? (sentSnap.data()?.uids || []) : [])
    const newlySent: string[] = []

    for (const [key, slot] of Object.entries(slots as Record<string, any>)) {
      if (!key.startsWith(tomorrowStr + '_')) continue
      if (slot?.type !== 'deposante') continue
      if (slot?.acceptee !== true) continue
      const trigramme = (slot?.trigramme || '').toUpperCase()
      if (!trigramme) continue
      const depSnap = await adminDb.collection('deposante').where('trigramme', '==', trigramme).limit(1).get()
      if (depSnap.empty) continue
      const depDoc = depSnap.docs[0]
      const dep = depDoc.data() as any
      if (alreadySent.has(depDoc.id)) continue
      if (!dep.email) continue
      const creneau = key.slice(tomorrowStr.length + 1)
      const piecesIds: string[] = Array.isArray(slot?.pieceIds) ? slot.pieceIds : []
      const dateFr = new Date(tomorrowStr + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

      const piecesData: { sku: string; nom: string; imageUrl: string; categorie: string }[] = []
      for (const pid of piecesIds) {
        try {
          const ps = await adminDb.collection('produits').doc(pid).get()
          if (!ps.exists) continue
          const pd = ps.data() as any
          piecesData.push({
            sku: pd.sku || '',
            nom: (pd.nom || '').replace(`${pd.sku || ''} - `, ''),
            imageUrl: pd.imageUrl || pd.photos?.face || '',
            categorie: (pd.categorie || '').replace('DEP - ', ''),
          })
        } catch {}
      }

      const piecesHtml = piecesData.length > 0
        ? `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;"><tr>${piecesData.map(p => `
            <td style="padding:6px;vertical-align:top;text-align:center;width:120px;">
              ${p.imageUrl ? `<img src="${p.imageUrl}" alt="" width="100" height="100" style="display:block;object-fit:cover;border:1px solid #eee;border-radius:6px;margin:0 auto 6px;" />` : ''}
              <div style="font-size:11px;font-weight:bold;color:#22209C;">${p.sku}</div>
              <div style="font-size:11px;color:#444;">${p.nom}</div>
              <div style="font-size:10px;color:#888;">${p.categorie}</div>
            </td>`).join('')}</tr></table>`
        : ''

      try {
        await resend.emails.send({
          from: 'Nouvelle Rive <noreply@nouvellerive.eu>',
          to: dep.email,
          cc: 'nouvelleriveparis@gmail.com',
          subject: `Rappel — votre dépôt demain à ${creneau} 💙`,
          html: `
            <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#000;">
              <h1 style="color:#22209C;">À demain 💙</h1>
              <p>Bonjour ${dep.prenom || ''},</p>
              <p>Petit rappel : votre rendez-vous de dépôt est confirmé pour <strong>${dateFr} à ${creneau}</strong>, en boutique au 8 rue des Écouffes, 75004 Paris.</p>
              <p style="margin-top:16px;"><strong>🪪 Pensez à apporter votre pièce d'identité.</strong></p>
              <p style="margin-top:16px;"><strong>Vos ${piecesData.length} pièce${piecesData.length > 1 ? 's' : ''} à déposer :</strong></p>
              ${piecesHtml}
              <p style="margin-top:24px;">
                <a href="https://www.nouvellerive.eu/deposante/calendrier" style="display:inline-block;background:#22209C;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;">Voir mon RDV</a>
              </p>
              <p style="font-size:12px;color:#888;margin-top:32px;">À demain en boutique 🌊</p>
            </div>
          `,
        })
        newlySent.push(depDoc.id)
      } catch (e: any) {
        console.error(`[cron/reminders] rappel déposante échoué ${depDoc.id}:`, e?.message)
      }
    }

    if (newlySent.length > 0) {
      await adminDb.collection('rdvReminders').doc(tomorrowStr).set({
        uids: Array.from(new Set([...Array.from(alreadySent), ...newlySent])),
      }, { merge: true })
      actions.push(`rappel-deposantes-${newlySent.length}`)
    }

    // Rappel J-1 chineuse — mail + push pour son restock du lendemain
    const sentChinSnap = await adminDb.collection('rdvReminders').doc(tomorrowStr).get()
    const alreadySentChin = new Set<string>(sentChinSnap.exists ? (sentChinSnap.data()?.chineuseUids || []) : [])
    const newlySentChin: string[] = []

    for (const [key, slot] of Object.entries(slots as Record<string, any>)) {
      if (!key.startsWith(tomorrowStr + '_')) continue
      if (slot?.type !== 'chineuse') continue
      if (!slot?.nom) continue
      const creneau = key.slice(tomorrowStr.length + 1)
      const chin = await findChineuse(slot.nom, slot.trigramme) as any
      if (!chin) continue
      if (chin.mailingRestockActif === false) continue
      const chinKey = (chin.authUid || chin.email || slot.nom) as string
      if (alreadySentChin.has(chinKey)) continue
      const dateFr = new Date(tomorrowStr + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

      // Compte les actions à prévoir, évaluées à la date du restock (demain)
      const triForCount = (slot.trigramme || chin.trigramme || '').toString().toUpperCase()
      const refDate = new Date(tomorrowStr + 'T12:00:00')
      const { aRecuperer, prixABaisser, stockActif } = await actionsChineuse(triForCount, refDate)
      const cible = typeof chin.cibleStock === 'number' ? chin.cibleStock : 0
      const aAmener = Math.max(0, cible - stockActif - aRecuperer.length)
      const renderPieces = (pieces: PieceInfo[]) => pieces.length === 0 ? '' : `
                <table cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;"><tr>${pieces.map(p => `
                  <td style="padding:6px;vertical-align:top;text-align:center;width:120px;">
                    ${p.imageUrl ? `<img src="${p.imageUrl}" alt="" width="100" height="100" style="display:block;object-fit:cover;border:1px solid #eee;border-radius:6px;margin:0 auto 6px;" />` : ''}
                    <div style="font-size:11px;font-weight:bold;color:#22209C;">${p.sku}</div>
                    <div style="font-size:11px;color:#444;">${p.nom}</div>
                    ${p.categorie ? `<div style="font-size:10px;color:#888;">${p.categorie}</div>` : ''}
                  </td>`).join('')}</tr></table>`
      const recapItems: string[] = []
      if (cible > 0 && aAmener > 0) recapItems.push(`📦 Amène au moins <strong>${aAmener} nouvelle${aAmener > 1 ? 's' : ''} pièce${aAmener > 1 ? 's' : ''}</strong>`)
      if (aRecuperer.length > 0) recapItems.push(`🚨 <strong>${aRecuperer.length} pièce${aRecuperer.length > 1 ? 's' : ''} à récupérer</strong>`)
      if (prixABaisser.length > 0) recapItems.push(`💸 <strong>${prixABaisser.length} pièce${prixABaisser.length > 1 ? 's' : ''} dont le prix doit être baissé</strong>`)
      const recapHtml = recapItems.length === 0 ? '' : `
                <p style="margin-top:20px;"><strong>Petit récap :</strong></p>
                <ul style="padding-left:20px;line-height:1.7;">
                  ${recapItems.map(i => `<li>${i}</li>`).join('')}
                </ul>`
      const detailsPiecesHtml = (aRecuperer.length > 0 || prixABaisser.length > 0) ? `
                ${aRecuperer.length > 0 ? `
                <p style="margin-top:16px;margin-bottom:4px;">🚨 Pièces à récupérer :</p>
                ${renderPieces(aRecuperer)}` : ''}
                ${prixABaisser.length > 0 ? `
                <p style="margin-top:16px;margin-bottom:4px;">💸 Prix à baisser :</p>
                ${renderPieces(prixABaisser)}` : ''}` : ''

      // Email
      const emails: string[] = Array.isArray(chin.emails) && chin.emails.length > 0 ? chin.emails : (chin.email ? [chin.email] : [])
      if (emails.length > 0) {
        try {
          await resend.emails.send({
            from: 'Nouvelle Rive <noreply@nouvellerive.eu>',
            to: emails,
            cc: 'nouvelleriveparis@gmail.com',
            subject: `Rappel — ton restock demain à ${creneau} 💙`,
            html: `
              <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#000;">
                <h1 style="color:#22209C;">À demain 💙</h1>
                <p>Hello ${chin.prenom || chin.nom || ''},</p>
                <p>N'oublie pas ton restock demain <strong>${dateFr} à ${creneau}</strong>, en boutique au 8 rue des Écouffes, 75004 Paris. On a hâte de te voir !!! 💙</p>
                ${recapHtml}
                ${detailsPiecesHtml}
                <p style="margin-top:24px;"><strong>As-tu bien préparé ton restock ?</strong></p>
                <ul style="padding-left:20px;line-height:1.7;">
                  <li>produits créés dans l'app</li>
                  <li>photos détourées proprement et portés vérifiés</li>
                  <li>produits étiquetés avec prix et SKU</li>
                </ul>
                <p style="margin-top:20px;">Au fait les filles en surface organisent leur temps de travail et leurs pauses autour des restocks, donc si tu arrives avec plus de 10 mn de retard, pense à leur ramener un cookie !</p>
                <p style="margin-top:12px;">On attend tes pépites avec impatience ! 🌊</p>
                <p style="margin-top:24px;">
                  <a href="https://www.nouvellerive.eu/chineuse/calendrier" style="display:inline-block;background:#22209C;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;">Voir mon RDV</a>
                </p>
                <p style="font-size:12px;color:#888;margin-top:32px;">À demain 🌊</p>
              </div>
            `,
          })
        } catch (e: any) {
          console.error(`[cron/reminders] rappel chineuse mail échoué ${chinKey}:`, e?.message)
        }
      }

      // Push
      if (chin.authUid) {
        await sendPushToOwner(chin.authUid, {
          title: `📦 Restock demain à ${creneau}`,
          body: `Rdv ${dateFr} en boutique 💙`,
          url: '/chineuse/calendrier',
          tag: `chineuse-restock-j1-${tomorrowStr}-${creneau}`,
        })
      }

      newlySentChin.push(chinKey)
    }

    if (newlySentChin.length > 0) {
      await adminDb.collection('rdvReminders').doc(tomorrowStr).set({
        chineuseUids: Array.from(new Set([...Array.from(alreadySentChin), ...newlySentChin])),
      }, { merge: true })
      actions.push(`rappel-chineuses-${newlySentChin.length}`)
    }
  }

  // 10h00 — rappels chineuses "faire tourner" + "récupérer"
  // Deux cycles parallèles, mêmes règles :
  // - orange : pièces sans prixBaisseLe, datePivot = dateReception + 2 mois (passage en "à baisser")
  // - rouge  : pièces avec prixBaisseLe, datePivot = prixBaisseLe + 1 mois (passage en "à récupérer")
  // Par cycle : J-10 / J-7 (push+mail "prends rdv" si pas de RDV dans la fenêtre, 1 envoi par pivot),
  // puis jour J (mail liste + push, relance 2j si pas de RDV dans 10j, notif/mail admin par chineuse).
  if (inWindow(h, m, 10, 0)) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const twoMonthsAgo = new Date(today); twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
    const oneMonthAgo = new Date(today); oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const daysBetween = (a: Date, b: Date) => Math.ceil((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))

    // Index des RDV futurs (≤ 11 jours) par trigramme
    const futureRdvByTri: Record<string, Date[]> = {}
    const monthsToCheck = new Set<string>()
    for (let i = 0; i <= 11; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i)
      monthsToCheck.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    for (const mk of monthsToCheck) {
      const sn = await adminDb.collection('restocks').doc(mk).get()
      if (!sn.exists) continue
      const slots = (sn.data()?.slots || {}) as Record<string, any>
      for (const [key, slot] of Object.entries(slots)) {
        if (slot?.type !== 'chineuse') continue
        const dStr = key.split('_')[0]
        const slotDate = new Date(dStr + 'T12:00:00')
        if (slotDate < today) continue
        const tri = (slot.trigramme || '').toString().toUpperCase()
        if (!tri) continue
        ;(futureRdvByTri[tri] ||= []).push(slotDate)
      }
    }

    const toInfo = (p: any): PieceInfo => ({
      sku: p.sku || '',
      nom: (p.nom || '').replace(`${p.sku || ''} - `, ''),
      imageUrl: p.imageUrl || p.photos?.face || '',
      categorie: typeof p.categorie === 'object' ? (p.categorie?.label || '') : (p.categorie || ''),
      prix: p.prix,
      ancienPrix: p.ancienPrix,
    })

    type CycleKind = 'orange' | 'rouge'
    type CycleStage = 'jour-j' | 'j7' | 'j10'

    const piecesHtmlOf = (pieces: PieceInfo[]) => `<table cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;"><tr>${pieces.map(p => `
      <td style="padding:6px;vertical-align:top;text-align:center;width:120px;">
        ${p.imageUrl ? `<img src="${p.imageUrl}" alt="" width="100" height="100" style="display:block;object-fit:cover;border:1px solid #eee;border-radius:6px;margin:0 auto 6px;" />` : ''}
        <div style="font-size:11px;font-weight:bold;color:#22209C;">${p.sku}</div>
        <div style="font-size:11px;color:#444;">${p.nom}</div>
        ${typeof p.prix === 'number' ? `<div style="font-size:11px;color:#888;">${p.prix}€</div>` : ''}
      </td>`).join('')}</tr></table>`

    async function runCycle(opts: {
      kind: CycleKind
      stage: CycleStage
      pivotISO: string
      pieces: PieceInfo[]
      chin: any
      chinId: string
      tri: string
      rappels: any
    }): Promise<Record<string, any> | null> {
      const { kind, stage, pivotISO, pieces, chin, chinId, tri, rappels } = opts
      const prenom = chin.prenom || chin.nom || ''
      const nomCourt = chin.prenom || chin.nom || tri
      const emails: string[] = Array.isArray(chin.emails) && chin.emails.length > 0 ? chin.emails : (chin.email ? [chin.email] : [])

      // Cooldown / anti-spam
      const keyForPivot = kind === 'orange'
        ? (stage === 'j10' ? 'orangeJ10ForPivot' : stage === 'j7' ? 'orangeJ7ForPivot' : null)
        : (stage === 'j10' ? 'rougeJ10ForPivot' : stage === 'j7' ? 'rougeJ7ForPivot' : null)
      const keyForJourJ = kind === 'orange' ? 'orangeJourJSentAt' : 'rougeJourJSentAt'

      if (keyForPivot && rappels[keyForPivot] === pivotISO) return null
      if (stage === 'jour-j') {
        const lastSent = rappels[keyForJourJ]?.toDate?.() as Date | undefined
        if (lastSent && (today.getTime() - lastSent.getTime()) < 2 * 24 * 3600 * 1000) return null
      }

      // Textes
      let subject = ''
      let html = ''
      let pushTitle = ''
      let pushBody = ''
      let pushUrl = '/chineuse/calendrier'

      if (stage === 'j10' && kind === 'orange') {
        subject = `Tu nous amènes de nouvelles pépites ? 💙`
        html = `
          <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#000;">
            <h1 style="color:#22209C;">Tu nous amènes de nouvelles pépites ? 💙</h1>
            <p>Hello ${prenom},</p>
            <p>Tes plus anciennes pièces atteignent bientôt 2 mois en boutique. Il est temps de prendre rdv pour faire tourner ton stock 🌊</p>
            <p style="margin-top:24px;"><a href="https://www.nouvellerive.eu/chineuse/calendrier" style="display:inline-block;background:#22209C;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;">Prendre RDV</a></p>
          </div>`
        pushTitle = `🌊 Tu nous amènes des pépites ?`
        pushBody = `Il est temps de prendre rdv pour faire tourner ton stock`
      } else if (stage === 'j7' && kind === 'orange') {
        subject = `Plus que 7j pour prendre rdv ma vie ! 💙`
        html = `
          <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#000;">
            <h1 style="color:#22209C;">Plus que 7j ma vie ! ⏰</h1>
            <p>Hello ${prenom},</p>
            <p>Tes plus anciennes pièces vont passer en "à faire tourner" dans une semaine. Prends rdv au plus vite pour les renouveler 🌊</p>
            <p style="margin-top:24px;"><a href="https://www.nouvellerive.eu/chineuse/calendrier" style="display:inline-block;background:#22209C;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;">Prendre RDV</a></p>
          </div>`
        pushTitle = `⏰ Plus que 7j ma vie !`
        pushBody = `Prends rdv au plus vite pour faire tourner ton stock`
      } else if (stage === 'jour-j' && kind === 'orange') {
        subject = `Il est temps de baisser les prix 💸`
        html = `
          <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#000;">
            <h1 style="color:#22209C;">Il est temps de baisser les prix 💸</h1>
            <p>Hello ${prenom},</p>
            <p>Les ${pieces.length} pièce${pieces.length > 1 ? 's' : ''} ci-dessous ${pieces.length > 1 ? 'sont' : 'est'} en boutique depuis +2 mois. Il est temps de baisser leur prix (ou de prendre rdv pour venir les chercher) 🌊</p>
            ${piecesHtmlOf(pieces)}
            <p style="margin-top:24px;"><a href="https://www.nouvellerive.eu/chineuse/mes-produits" style="display:inline-block;background:#22209C;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;">Voir mes pièces</a></p>
          </div>`
        pushTitle = `💸 ${pieces.length} prix à baisser`
        pushBody = `Il est temps de faire tourner ton stock en boutique`
        pushUrl = '/chineuse/mes-produits'
      } else if (stage === 'j10' && kind === 'rouge') {
        subject = `Tes pièces baissées arrivent à échéance 💙`
        html = `
          <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#000;">
            <h1 style="color:#22209C;">Pense à venir chercher tes pièces 💙</h1>
            <p>Hello ${prenom},</p>
            <p>Plusieurs de tes pièces baissées passent à "à récupérer" dans 10 jours. Prends rdv pour les emporter (et nous amener de nouvelles pépites en passant !) 🌊</p>
            <p style="margin-top:24px;"><a href="https://www.nouvellerive.eu/chineuse/calendrier" style="display:inline-block;background:#22209C;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;">Prendre RDV</a></p>
          </div>`
        pushTitle = `💙 Pense à venir chercher tes pièces`
        pushBody = `Tes pièces baissées passent à "à récupérer" dans 10 jours`
      } else if (stage === 'j7' && kind === 'rouge') {
        subject = `Plus que 7j pour venir chercher tes pièces ma vie ! 💙`
        html = `
          <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#000;">
            <h1 style="color:#22209C;">Plus que 7j ma vie ! ⏰</h1>
            <p>Hello ${prenom},</p>
            <p>Tes pièces baissées passent à "à récupérer" dans une semaine. Prends rdv au plus vite pour venir les chercher 🌊</p>
            <p style="margin-top:24px;"><a href="https://www.nouvellerive.eu/chineuse/calendrier" style="display:inline-block;background:#22209C;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;">Prendre RDV</a></p>
          </div>`
        pushTitle = `⏰ Plus que 7j pour venir chercher !`
        pushBody = `Prends rdv au plus vite pour récupérer tes pièces`
      } else {
        // jour-j rouge
        subject = `Il est temps de venir chercher tes pièces 💙`
        html = `
          <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#000;">
            <h1 style="color:#22209C;">Il est temps de venir chercher tes pièces 💙</h1>
            <p>Hello ${prenom},</p>
            <p>Les ${pieces.length} pièce${pieces.length > 1 ? 's' : ''} ci-dessous ${pieces.length > 1 ? 'sont' : 'est'} baissée${pieces.length > 1 ? 's' : ''} depuis +1 mois et ${pieces.length > 1 ? 'doivent' : 'doit'} être récupérée${pieces.length > 1 ? 's' : ''}. Prends rdv pour les emporter 🌊</p>
            ${piecesHtmlOf(pieces)}
            <p style="margin-top:24px;"><a href="https://www.nouvellerive.eu/chineuse/calendrier" style="display:inline-block;background:#22209C;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;">Prendre RDV</a></p>
          </div>`
        pushTitle = `💙 ${pieces.length} pièce${pieces.length > 1 ? 's' : ''} à récupérer`
        pushBody = `Prends rdv pour venir les chercher en boutique`
      }

      // Mail chineuse
      if (emails.length > 0) {
        try {
          await resend.emails.send({
            from: 'Nouvelle Rive <noreply@nouvellerive.eu>',
            to: emails,
            cc: 'nouvelleriveparis@gmail.com',
            subject,
            html,
          })
        } catch (e: any) {
          console.error(`[cron/reminders] ${kind}-${stage} mail échoué ${chinId}:`, e?.message)
        }
      }

      // Push chineuse
      if (chin.authUid) {
        await sendPushToOwner(chin.authUid, {
          title: pushTitle,
          body: pushBody,
          url: pushUrl,
          tag: `chineuse-${kind}-${stage}-${chinId}-${dateStr}`,
        })
      }

      // Notif + mail admin uniquement pour le jour J
      if (stage === 'jour-j') {
        const verb = kind === 'orange' ? 'à baisser' : 'à récupérer'
        const intro = kind === 'orange' ? 'Mail "baisse de prix" envoyé' : 'Mail "récupération" envoyé'
        await sendPushToOwner('boutique', {
          title: `${kind === 'orange' ? '💸' : '💙'} ${pieces.length} ${kind === 'orange' ? 'prix' : 'pièces'} ${nomCourt} ${verb}`,
          body: `${intro} à la chineuse — relance dans 2j si rien ne bouge`,
          url: '/admin/nos-produits',
          tag: `admin-${kind}-jour-j-${chinId}-${dateStr}`,
        })
        try {
          await resend.emails.send({
            from: 'Nouvelle Rive <noreply@nouvellerive.eu>',
            to: 'nouvelleriveparis@gmail.com',
            subject: `${pieces.length} ${kind === 'orange' ? 'prix' : 'pièces'} ${nomCourt} ${verb}`,
            html: `<p>${intro} à ${nomCourt}. Pièces concernées :</p>${piecesHtmlOf(pieces)}`,
          })
        } catch {}
      }

      actions.push(`chineuse-${kind}-${stage}-${chinId}`)

      if (stage === 'jour-j') return { [keyForJourJ]: FieldValue.serverTimestamp() }
      if (keyForPivot) return { [keyForPivot]: pivotISO }
      return null
    }

    const chineusesSnap = await adminDb.collection('chineuse').get()
    for (const chinDoc of chineusesSnap.docs) {
      const chin = chinDoc.data() as any
      const tri = (chin.trigramme || '').toString().toUpperCase()
      if (!tri) continue
      // Chineuse en pause : aucun mail/push automatique
      if (chin.mailingRestockActif === false) continue
      // Petites séries : pas de cycle "faire tourner" (normal qu'elles gardent les refs longtemps),
      // mais le mail "stock bas" reste actif (cf. bloc plus bas)
      const isSmallBatch = chin.stockType === 'smallBatch'

      // Charger les produits actifs une seule fois et trier par cycle
      const prodsSnap = await adminDb.collection('produits').where('trigramme', '==', tri).get()
      let dateMinCreated: Date | null = null
      let dateMinBaisse: Date | null = null
      const piecesOranges: PieceInfo[] = []
      const piecesRouges: PieceInfo[] = []
      let stockActif = 0
      let dateLastRestock: Date | null = null
      type VenteInfo = { sku: string; nom: string; imageUrl: string; prix: number; dateVente: Date }
      const toutesVentes: VenteInfo[] = []
      for (const d of prodsSnap.docs) {
        const p = d.data() as any
        // Collecter toutes les ventes ; on filtrera par "depuis le dernier restock" après la boucle
        if (p.vendu === true || p.statut === 'vendu') {
          const dv = p.dateVente?.toDate?.()
          if (dv instanceof Date) {
            toutesVentes.push({
              sku: p.sku || '',
              nom: (p.nom || '').replace(`${p.sku || ''} - `, ''),
              imageUrl: p.imageUrl || p.photos?.face || '',
              prix: p.prixVenteReel || p.prix || 0,
              dateVente: dv,
            })
          }
          continue
        }
        if (p.statut === 'supprime' || p.statut === 'retour') continue
        if (p.statutRecuperation === 'aRecuperer') continue
        if (p.recu === true) {
          stockActif++
          const dr = p.dateReception?.toDate?.()
          if (dr instanceof Date && (!dateLastRestock || dr > dateLastRestock)) dateLastRestock = dr
        }
        if (p.prixBaisseLe) {
          const bd = p.prixBaisseLe?.toDate?.()
          if (!(bd instanceof Date)) continue
          if (!dateMinBaisse || bd < dateMinBaisse) dateMinBaisse = bd
          if (bd < oneMonthAgo) piecesRouges.push(toInfo(p))
        } else {
          // Cycle orange basé sur la date de réception en boutique (pas createdAt)
          const recep = p.dateReception?.toDate?.()
          if (!(recep instanceof Date)) continue
          if (!dateMinCreated || recep < dateMinCreated) dateMinCreated = recep
          if (recep < twoMonthsAgo) piecesOranges.push(toInfo(p))
        }
      }
      // Ventes depuis le dernier restock (fallback 30j si jamais reçu)
      const cutoff30j = new Date(today); cutoff30j.setDate(cutoff30j.getDate() - 30)
      const ventesCutoff = dateLastRestock || cutoff30j
      const ventesDepuisRestock = toutesVentes.filter(v => v.dateVente >= ventesCutoff)
      ventesDepuisRestock.sort((a, b) => b.dateVente.getTime() - a.dateVente.getTime())
      const ventesCount = ventesDepuisRestock.length
      const top3 = ventesDepuisRestock.slice(0, 3)

      const rdvs = futureRdvByTri[tri] || []
      const hasRdvWithinDays = (n: number) => rdvs.some(r => {
        const days = daysBetween(r, today)
        return days >= 0 && days <= n
      })

      const rappelsDoc = await adminDb.collection('rappelsChineuse').doc(chinDoc.id).get()
      const rappels = rappelsDoc.exists ? (rappelsDoc.data() as any) : {}
      const updates: Record<string, any> = {}

      const cycles: Array<{ kind: CycleKind; dateMin: Date | null; offsetMonths: number; pieces: PieceInfo[] }> = isSmallBatch
        ? []
        : [
          { kind: 'orange', dateMin: dateMinCreated, offsetMonths: 2, pieces: piecesOranges },
          { kind: 'rouge', dateMin: dateMinBaisse, offsetMonths: 1, pieces: piecesRouges },
        ]

      // Phase 1 : identifier les stages candidats pour chaque cycle
      type Candidate = { cyc: typeof cycles[number]; stage: CycleStage; pivotISO: string }
      const candidates: Candidate[] = []
      for (const cyc of cycles) {
        if (!cyc.dateMin) continue
        const datePivot = new Date(cyc.dateMin); datePivot.setMonth(datePivot.getMonth() + cyc.offsetMonths)
        const daysToPivot = daysBetween(datePivot, today)
        let stage: CycleStage | null = null
        if (cyc.pieces.length > 0) stage = 'jour-j'
        else if (daysToPivot >= 1 && daysToPivot <= 7) stage = 'j7'
        else if (daysToPivot >= 8 && daysToPivot <= 10) stage = 'j10'
        if (!stage) continue

        const rdvWindow = stage === 'j7' ? 7 : 10
        if (hasRdvWithinDays(rdvWindow)) continue

        const pivotISO = `${datePivot.getFullYear()}-${String(datePivot.getMonth() + 1).padStart(2, '0')}-${String(datePivot.getDate()).padStart(2, '0')}`
        candidates.push({ cyc, stage, pivotISO })
      }

      // Phase 2 : envoyer tous les "jour-j" (orange et rouge peuvent coexister, c'est légitime)
      for (const c of candidates.filter(c => c.stage === 'jour-j')) {
        const update = await runCycle({
          kind: c.cyc.kind,
          stage: c.stage,
          pivotISO: c.pivotISO,
          pieces: c.cyc.pieces,
          chin,
          chinId: chinDoc.id,
          tri,
          rappels: { ...rappels, ...updates },
        })
        if (update) Object.assign(updates, update)
      }

      // Phase 3 : 1 seul rappel "prends rdv" par exécution
      // Priorité : J-10 d'abord (s'il est candidat) — J-7 ne tourne jamais en même temps.
      // À stage égal : rouge > orange (urgent côté action).
      const rdvCands = candidates.filter(c => c.stage === 'j7' || c.stage === 'j10')
      if (rdvCands.length > 0) {
        rdvCands.sort((a, b) => {
          if (a.stage !== b.stage) return a.stage === 'j10' ? -1 : 1
          return a.cyc.kind === 'rouge' ? -1 : 1
        })
        const c = rdvCands[0]
        const update = await runCycle({
          kind: c.cyc.kind,
          stage: c.stage,
          pivotISO: c.pivotISO,
          pieces: c.cyc.pieces,
          chin,
          chinId: chinDoc.id,
          tri,
          rappels: { ...rappels, ...updates },
        })
        if (update) Object.assign(updates, update)
      }

      // Stock bas : nb pièces en boutique < cibleStock * 0.8 + pas de RDV dans 10j
      // Cooldown 7j pour ne pas spammer. Cible 0 = désactivé.
      const cible = typeof chin.cibleStock === 'number' ? chin.cibleStock : 0
      if (cible > 0 && stockActif < cible * 0.8 && !hasRdvWithinDays(10)) {
        const stockBasLastSent = (rappels.stockBasSentAt?.toDate?.() as Date | undefined)
        const cooldownOK = !stockBasLastSent || (today.getTime() - stockBasLastSent.getTime()) >= 7 * 24 * 3600 * 1000
        if (cooldownOK) {
          const prenom = chin.prenom || chin.nom || ''
          const nomCourt = chin.prenom || chin.nom || tri
          const manquantes = cible - stockActif
          const pct = Math.round((1 - stockActif / cible) * 100)
          const emails: string[] = Array.isArray(chin.emails) && chin.emails.length > 0 ? chin.emails : (chin.email ? [chin.email] : [])

          const top3Html = top3.length === 0 ? '' : `
            <p style="margin-top:24px;"><strong>Tes ${top3.length > 1 ? `${top3.length} dernières` : 'dernière'} ventes :</strong></p>
            <table cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;"><tr>${top3.map(v => `
              <td style="padding:6px;vertical-align:top;text-align:center;width:120px;">
                ${v.imageUrl ? `<img src="${v.imageUrl}" alt="" width="100" height="100" style="display:block;object-fit:cover;border:1px solid #eee;border-radius:6px;margin:0 auto 6px;" />` : ''}
                <div style="font-size:11px;font-weight:bold;color:#22209C;">${v.sku}</div>
                <div style="font-size:11px;color:#444;">${v.nom}</div>
                ${v.prix > 0 ? `<div style="font-size:11px;color:#888;">${v.prix}€</div>` : ''}
              </td>`).join('')}</tr></table>`
          const manquantesText = manquantes > 0
            ? `Amène-nous <strong>${manquantes} nouvelle${manquantes > 1 ? 's' : ''} pépite${manquantes > 1 ? 's' : ''}</strong> pour remplir le portant !`
            : `Time to restock !`

          if (emails.length > 0) {
            try {
              await resend.emails.send({
                from: 'Nouvelle Rive <noreply@nouvellerive.eu>',
                to: emails,
                cc: 'nouvelleriveparis@gmail.com',
                subject: ventesCount > 0
                  ? `WOUAOU t'as vendu ${ventesCount} pièce${ventesCount > 1 ? 's' : ''}, time to restock 🌊`
                  : `Viens nous amener tes pépites ma vie 🌊`,
                html: `
                  <div style="font-family: Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#000;">
                    <h1 style="color:#22209C;">${ventesCount > 0 ? `WOUAOU bravo ${prenom} 🦾` : `Viens nous amener tes pépites 🌊`}</h1>
                    <p>Hello ${prenom},</p>
                    ${ventesCount > 0
                      ? `<p>Tu as vendu <strong>${ventesCount} pièce${ventesCount > 1 ? 's' : ''}</strong> depuis ton dernier restock, c'est ouf 💙</p>`
                      : ''}
                    <p>Il te reste <strong>${stockActif} pièce${stockActif > 1 ? 's' : ''}</strong> en boutique (cible : ${cible}). ${manquantesText}</p>
                    ${top3Html}
                    <p style="margin-top:24px;font-size:13px;color:#666;">Pour info, tu peux consulter tes best sellers et tes stats sur ta <a href="https://www.nouvellerive.eu/chineuse/performance" style="color:#22209C;font-weight:bold;">page performance</a> 🌊</p>
                    <p style="margin-top:24px;"><a href="https://www.nouvellerive.eu/chineuse/calendrier" style="display:inline-block;background:#22209C;color:#fff;padding:12px 20px;text-decoration:none;border-radius:6px;">Prendre RDV restock</a></p>
                  </div>`,
              })
            } catch (e: any) {
              console.error(`[cron/reminders] stock-bas mail échoué ${chinDoc.id}:`, e?.message)
            }
          }

          if (chin.authUid) {
            await sendPushToOwner(chin.authUid, {
              title: `🌊 Viens nous amener tes pépites`,
              body: `Il te reste ${stockActif} pièces en boutique (cible ${cible})`,
              url: '/chineuse/calendrier',
              tag: `chineuse-stock-bas-${chinDoc.id}-${dateStr}`,
            })
          }

          // Notif + mail admin
          await sendPushToOwner('boutique', {
            title: `📉 Stock ${nomCourt} bas`,
            body: `${stockActif} pièces (cible ${cible}, -${pct}%) — il en manque ${manquantes}`,
            url: '/admin/selectionneuses',
            tag: `admin-stock-bas-${chinDoc.id}-${dateStr}`,
          })
          try {
            await resend.emails.send({
              from: 'Nouvelle Rive <noreply@nouvellerive.eu>',
              to: 'nouvelleriveparis@gmail.com',
              subject: `Stock ${nomCourt} bas : ${stockActif}/${cible} (-${pct}%)`,
              html: `<p>Stock ${nomCourt} bas : <strong>${stockActif} pièces en boutique</strong> (cible ${cible}, manque ${manquantes}). Mail "viens restocker" envoyé à la chineuse, relance dans 7j si rien ne bouge.</p>`,
            })
          } catch {}

          updates.stockBasSentAt = FieldValue.serverTimestamp()
          actions.push(`chineuse-stock-bas-${chinDoc.id}`)
        }
      }

      if (Object.keys(updates).length > 0) {
        await adminDb.collection('rappelsChineuse').doc(chinDoc.id).set(updates, { merge: true })
      }
    }
  }

  return NextResponse.json({ success: true, parisTime: `${h}:${String(m).padStart(2, '0')}`, dateStr, actions })
}
