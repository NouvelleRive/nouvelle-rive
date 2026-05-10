import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const ref = db.collection('iconiques').doc('bagues-voiture-ines-pineau')
const cur = (await ref.get()).data().videos || []
const seen = new Set()
const out = []
for (const url of cur) {
  // Extract reel ID from the URL (everything before -fs-)
  const m = url.match(/\/videos\/([^\/]+?)-fs-/)
  const id = m ? m[1] : url
  if (seen.has(id)) continue
  seen.add(id)
  out.push(url)
}
await ref.update({ videos: out })
console.log(`Dédoublonné: ${cur.length} → ${out.length}`)
out.forEach((v, i) => console.log(`  ${i+1}. ${v}`))
process.exit(0)
