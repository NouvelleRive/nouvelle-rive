// Inspecte un produit par SKU pour comprendre pourquoi il n'apparaît pas sur le site
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const sku = (process.argv[2] || 'AGE145').toUpperCase()
const snap = await db.collection('produits').where('sku', '==', sku).get()

if (snap.empty) {
  console.log(`❌ Aucun produit avec SKU=${sku}`)
  process.exit(0)
}

for (const doc of snap.docs) {
  const p = doc.data()
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📦 ${sku}  (id=${doc.id})`)
  console.log('  nom            :', p.nom)
  console.log('  quantite       :', p.quantite)
  console.log('  vendu          :', p.vendu, p.vendu === true ? '   ⛔ BLOQUE LE SITE' : '')
  console.log('  statut         :', p.statut, ['retour','supprime'].includes(p.statut) ? '   ⛔ BLOQUE LE SITE' : '')
  console.log('  recu           :', p.recu, p.recu === false ? '   ⛔ BLOQUE LE SITE' : '')
  console.log('  hidden         :', p.hidden, p.hidden === true ? '   ⛔ BLOQUE LE SITE' : '')
  console.log('  forceDisplay   :', p.forceDisplay, p.forceDisplay === false ? '   ⛔ BLOQUE LE SITE' : '')
  console.log('  imageUrls      :', (p.imageUrls?.length || 0) + ' images', !p.imageUrls?.length && !p.imageUrl ? '   ⛔ BLOQUE LE SITE' : '')
  console.log('  ── restock ──')
  console.log('  statutRestock      :', p.statutRestock)
  console.log('  quantiteRestock    :', p.quantiteRestock)
  console.log('  dateDemandeRestock :', p.dateDemandeRestock?.toDate?.()?.toISOString?.() || p.dateDemandeRestock)
  console.log('  dateRestock        :', p.dateRestock?.toDate?.()?.toISOString?.() || p.dateRestock)
  console.log('  restockParVendeuse :', p.restockParVendeuse)
  console.log('  ── vente ──')
  console.log('  dateVente      :', p.dateVente?.toDate?.()?.toISOString?.() || p.dateVente)
  console.log('  dateRupture    :', p.dateRupture?.toDate?.()?.toISOString?.() || p.dateRupture)
  console.log('  ── tri ──')
  console.log('  createdAt      :', p.createdAt?.toDate?.()?.toISOString?.() || p.createdAt, p.createdAt == null ? '   ⛔ orderBy createdAt L EXCLUT' : '')

  // Compter combien de produits non vendus avec createdAt plus récent (pour estimer si AGE145 est dans la 1ère page de 100)
  const plusRecent = await db.collection('produits')
    .where('vendu', '==', false)
    .where('createdAt', '>', p.createdAt)
    .count().get()
  console.log('  position approx:', plusRecent.data().count + 1, '(non vendus avec createdAt plus récent)')
}
process.exit(0)
