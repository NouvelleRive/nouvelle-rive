import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

// AGE49 = Blazer Jane Noir XS vendu, Cloudinary
const url = 'https://res.cloudinary.com/dvgwwbqrx/image/upload/c_fill,g_auto,ar_1:1,w_1200,h_1200,e_improve,e_auto_brightness,e_auto_contrast,e_vibrance:15,e_sharpen:60,q_auto:good,f_auto/v1765649875/produits/lvn2gnoo0nctwtdstf9e.jpg'
await db.collection('iconiques').doc('diamant-age-paris').update({ images: [url] })
console.log('✅ diamant-age-paris.images = [AGE49 Cloudinary]')
process.exit(0)
