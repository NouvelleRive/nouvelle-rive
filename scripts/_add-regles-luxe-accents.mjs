// Ajoute les règles marque manquantes à siteConfig/luxe.
// Le matching est un `includes` insensible à la casse mais PAS aux accents :
// "Hermes" ne matchait donc pas "Hermès", "Celine" pas "Céline", "Alaia" pas "Azzedine Alaïa".
// + Issey Miyake, absente de la liste.
// Idempotent : ne réécrit pas une valeur déjà présente.

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: new URL('../.env.local', import.meta.url).pathname })

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  })
}

const db = getFirestore()

function gid() {
  return Math.random().toString(36).slice(2, 11)
}

const A_AJOUTER = ['Hermès', 'Céline', 'Alaïa', 'Issey Miyake']

const ref = db.collection('siteConfig').doc('luxe')
const snap = await ref.get()
if (!snap.exists) throw new Error('siteConfig/luxe introuvable — abandon')

const regles = snap.data().regles || []
const dejaLa = new Set(
  regles
    .filter(r => r.criteres?.length === 1 && r.criteres[0].type === 'marque')
    .map(r => r.criteres[0].valeur.toLowerCase())
)

const nouvelles = A_AJOUTER.filter(m => !dejaLa.has(m.toLowerCase())).map(m => ({
  id: gid(),
  criteres: [{ type: 'marque', valeur: m }],
}))

if (nouvelles.length === 0) {
  console.log('Rien à ajouter, tout est déjà là.')
  process.exit(0)
}

await ref.update({ regles: [...regles, ...nouvelles], updatedAt: new Date() })
console.log(`✅ ${nouvelles.length} règles ajoutées : ${nouvelles.map(r => r.criteres[0].valeur).join(', ')}`)
console.log(`   siteConfig/luxe passe de ${regles.length} à ${regles.length + nouvelles.length} règles`)

// Invalide le blob cache produits pour que /luxe reflète immédiatement les nouvelles règles.
const file = getStorage().bucket().file('_cache/produits-all.json.gz')
const [exists] = await file.exists()
if (exists) {
  await file.delete()
  console.log('✅ Cache blob produits-all vidé')
}
