// Restaure les ebayListingId / ebayOfferId effacés par erreur dans cleanup-ebay-listings.mjs.
// Les paires SKU → (listingId, offerId) viennent de la sortie de la dernière exécution.
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.env.FIREBASE_PROJECT_ID
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
const db = getFirestore()

const PAIRS = [
  ['PS48',   '287164134821', '121275690011'],
  ['PS90',   '287164130030', '121210944011'],
  ['PS49',   '287164250874', '123062303011'],
  ['PS33',   '287164129571', '121209861011'],
  ['DM371',  '287197735991', '131529723011'],
  ['CAM77',  '287164277319', '123065723011'],
  ['SOI123', '287164482634', '123129519011'],
  ['SOI135', '287165995303', '123693662011'],
  ['PS94',   '287163767835', '120806777011'],
  ['CAM88',  '287165879837', '123662364011'],
  ['DM62',   '287164462772', '123126924011'],
  ['CAM96',  '287164466101', '123127307011'],
  ['PS104',  '287164167779', '121287678011'],
  ['AIM40',  '287166006880', '123698312011'],
  ['CAM83',  '287164223894', '121686202011'],
  ['AIM38',  '287166004360', '123696262011'],
  ['PS103',  '287164134415', '121275133011'],
  ['CAM8',   '287164169610', '121674334011'],
  ['PRI68',  '287164253162', '122145006011'],
  ['CAM3',   '287164321988', '123074663011'],
  ['PS14',   '287164275009', '123065480011'],
  ['PS156',  '287214743550', '134254039011'],
  ['NR57',   '287164469109', '123127499011'],
  ['AIM42',  '287165990790', '123691618011'],
  ['SOI105', '287164482946', '123129538011'],
  ['PS47',   '287164251282', '121980489011'],
  ['CAM12',  '287164327151', '123075761011'],
  ['NR68',   '287164256306', '121664172011'],
  ['CAM74',  '287164168949', '121666581011'],
  ['CAM65',  '287164187600', '121677780011'],
  ['PRI97',  '287164251972', '122012175011'],
  ['SOI94',  '287164483810', '123129703011'],
  ['PS145',  '287214737801', '134253236011'],
  ['FRU22',  '287165993077', '123692688011'],
  ['PS106',  '287164474416', '123128176011'],
  ['CAM2',   '287164169304', '121672801011'],
  ['CAM1',   '287165884394', '123663145011'],
  ['CAM95',  '287164168011', '121623198011'],
  ['NR34',   '287164474159', '123128143011'],
  ['PS81',   '287164240189', '121980361011'],
  ['CAM16',  '287164340541', '123081925011'],
  ['PS113',  '287164128229', '121208695011'],
  ['PS64',   '287164152030', '121282705011'],
  ['PS141',  '287214743087', '134253966011'],
  ['CAM69',  '287164447589', '123124800011'],
  ['PS101',  '287164127788', '121190621011'],
  ['PS99',   '287164452042', '123125593011'],
  ['CAM82',  '287165882998', '123662922011'],
  ['DM330',  '287165990210', '123691485011'],
  ['PS88',   '287163774908', '121177964011'],
  ['CAM5',   '287164472580', '123127891011'],
  ['PS154',  '287214739490', '134253535011'],
  ['PS98',   '287164460367', '123126765011'],
]

let ok = 0, miss = 0, fail = 0
for (const [sku, listingId, offerId] of PAIRS) {
  try {
    const q = await db.collection('produits').where('sku', '==', sku).limit(1).get()
    if (q.empty) { console.log(`⚠️  ${sku} introuvable`); miss++; continue }
    const doc = q.docs[0]
    const data = doc.data()
    const publishedOn = Array.isArray(data.publishedOn) ? data.publishedOn : []
    const newPublishedOn = publishedOn.includes('ebay') ? publishedOn : [...publishedOn, 'ebay']
    await doc.ref.update({ ebayListingId: listingId, ebayOfferId: offerId, publishedOn: newPublishedOn })
    console.log(`✅ ${sku}`)
    ok++
  } catch (e) {
    console.log(`❌ ${sku} : ${e.message}`)
    fail++
  }
}
console.log(`\n📊 Restauré : ${ok}, introuvables : ${miss}, erreurs : ${fail}`)
process.exit(0)
