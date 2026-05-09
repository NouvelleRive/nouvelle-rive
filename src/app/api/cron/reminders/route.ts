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

const CRON_SECRET = process.env.CRON_SECRET

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

  return NextResponse.json({ success: true, parisTime: `${h}:${String(m).padStart(2, '0')}`, dateStr, actions })
}
