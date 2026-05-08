import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const serviceAccount = JSON.parse(
  readFileSync(resolve(__dirname, 'firebase-service-account.json'), 'utf8')
)
initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

const snap = await db.collection('iconiques').get()
const list = []
snap.forEach((doc) => {
  const d = doc.data()
  list.push({
    id: doc.id,
    ordre: d.ordre || 0,
    nom: d.nom || '',
    pourquoiMust: d.pourquoiMust || '',
    histoire: d.histoire || '',
    nomEn: d.nomEn || '',
    pourquoiMustEn: d.pourquoiMustEn || '',
    histoireEn: d.histoireEn || '',
  })
})
list.sort((a, b) => a.ordre - b.ordre)

for (const it of list) {
  console.log('─'.repeat(80))
  console.log(`#${it.ordre}  id: ${it.id}`)
  console.log(`nom FR        : ${it.nom}`)
  console.log(`nomEn         : ${it.nomEn || '(vide)'}`)
  console.log(`pourquoiMust  : ${it.pourquoiMust}`)
  console.log(`pourquoiMustEn: ${it.pourquoiMustEn || '(vide)'}`)
  console.log(`histoire      : ${it.histoire || '(vide)'}`)
  console.log(`histoireEn    : ${it.histoireEn || '(vide)'}`)
}
console.log('─'.repeat(80))
console.log(`TOTAL: ${list.length} iconiques`)
