// Seed initial de siteConfig/sac pour matcher l'ancien filtre custom getSacsHauteCoutureProduits :
// 2 rules OU'ées : catégorie=sac + marque=luxe (special value dans getPageProduits) OU
// catégorie=sac + chineuse=<uid> pour chaque chineuse smallBatch.
// À jouer 1 fois après le déploiement du refactor /sac.

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

const rules = [
  {
    id: gid(),
    criteres: [
      { type: 'categorie', valeur: 'sac' },
      { type: 'marque', valeur: 'luxe' },
    ],
  },
]

// Collection au singulier ("chineuse") — cf. lib/getChineusesLiteCached.ts
const chineusesSnap = await db.collection('chineuse').where('stockType', '==', 'smallBatch').get()
for (const doc of chineusesSnap.docs) {
  rules.push({
    id: gid(),
    criteres: [
      { type: 'categorie', valeur: 'sac' },
      { type: 'chineuse', valeur: doc.id },
    ],
  })
}

console.log(`Écriture siteConfig/sac avec ${rules.length} rules (1 luxe + ${rules.length - 1} smallBatch chineuses)`)
await db.collection('siteConfig').doc('sac').set({
  regles: rules,
  updatedAt: new Date(),
})
console.log('✅ siteConfig/sac écrit')

// Invalide le blob cache produits/page pour que /sac reflète immédiatement les nouvelles rules.
const file = getStorage().bucket().file('_cache/produits-all.json.gz')
const [exists] = await file.exists()
if (exists) {
  await file.delete()
  console.log('✅ Cache blob produits-all vidé')
}
