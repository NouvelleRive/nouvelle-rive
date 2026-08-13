import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}
const db = getFirestore()

const id = 'Dd2LA8o83MExFXAIngL8Zp6C3nWZY_wemDBbvBvL4HrFhkPkQvKB'
await db.collection('commandes').doc(id).update({
  statut: 'preparee',
  numeroSuivi: FieldValue.delete(),
  dateExpedition: FieldValue.delete(),
})
const after = (await db.collection('commandes').doc(id).get()).data()
console.log('OK → statut:', after.statut, '| suivi:', after.numeroSuivi ?? '(supprimé)')
process.exit(0)
