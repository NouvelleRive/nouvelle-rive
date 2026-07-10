import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const vendeusesSnap = await db.collection('vendeuses').get()
const idToNom = new Map()
vendeusesSnap.forEach(d => idToNom.set(d.id, d.data().prenom || d.id))

const snap = await db.collection('pointages')
  .where('date', '>=', '2026-06-01')
  .where('date', '<=', '2026-06-31')
  .get()

const anomalies = []
snap.forEach(d => {
  const x = d.data()
  const arr = x.arrivee?.toDate?.()
  const dep = x.depart?.toDate?.()
  const dur = (arr && dep) ? (dep.getTime() - arr.getTime()) / 3600000 : 0
  if (dur > 15 || dur < 0) {
    anomalies.push({
      id: d.id,
      date: x.date,
      vid: x.vendeuseId,
      nom: idToNom.get(x.vendeuseId) || x.vendeuseId,
      arrIso: arr?.toISOString(),
      depIso: dep?.toISOString(),
      arrLocal: arr?.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
      depLocal: dep?.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
      dur,
    })
  }
})

console.log(`${anomalies.length} anomalies :\n`)
for (const a of anomalies) {
  console.log(`[${a.nom}] doc=${a.id}`)
  console.log(`  date champ = ${a.date}`)
  console.log(`  arrivée = ${a.arrLocal} (${a.arrIso})`)
  console.log(`  départ  = ${a.depLocal} (${a.depIso})`)
  console.log(`  durée = ${a.dur.toFixed(2)}h\n`)
}

process.exit(0)
