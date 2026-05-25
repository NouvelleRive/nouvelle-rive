// app/api/cron/reminders/route.ts
// Endpoint déclenché par Vercel Cron.
// Vérifie l'heure de Paris et envoie les notifs au tel boutique :
// - 11h50 : rappel pointage arrivée si vendeuse(s) sur planning du jour pas encore pointée(s)
// - 12h50 / 15h50 / 17h50 : "[Nom] arrive dans 10 min" pour restock 13h / 16h / 18h
// - 19h55 : rappel pointage départ si pas pointé
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'
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
      await sendPushToOwner('boutique', {
        title: `📦 ${data.nom} arrive dans 10 min`,
        body: `Restock prévu à ${r.slot}`,
        url: '/vendeuse/restock',
        tag: `restock-${dateStr}-${r.slot}`,
      })
      actions.push(`restock-${r.slot}`)
    }
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
          bcc: 'nouvelleriveparis@gmail.com',
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
  }

  return NextResponse.json({ success: true, parisTime: `${h}:${String(m).padStart(2, '0')}`, dateStr, actions })
}
