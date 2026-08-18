import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
if (!getApps().length) initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n') }), storageBucket: process.env.FIREBASE_STORAGE_BUCKET })

const bodyEn = `Buying a luxury bag secondhand is a fantastic deal — as long as you know how to spot a genuine piece. Counterfeits in 2026 are increasingly convincing, but a few expert reflexes are enough to unmask most fakes. Here's what to check, from the price to the serial number, with the specifics of vintage pieces.

## 1. The price, the seller and the sales channel

The first signal, before you even touch the bag: an unrealistic discount on an iconic model should raise a flag. Luxury depreciates little secondhand. Look at who is selling and through what channel: a professional who inspects their pieces, with an address and a reputation, is worth a thousand times more than an anonymous listing with suspiciously perfect photos.

## 2. The leather and the material

Luxury leather has a natural smell, a supple feel and a consistent grain. Be wary of materials that smell of plastic, or of grains that look too perfect or too synthetic. On vintage, a beautiful patina (a cowhide that shifts from beige to honey to brown) is often a sign of authenticity, not a flaw.

## 3. Stitching and finishing

On a genuine piece, the stitching is regular, straight, with no loose threads and a consistent stitch count. Irregular or crude stitching, or edges that are "glued" rather than sewn, is a warning sign. Check the edge painting (the trimmed leather borders): clean and even on a real one, sloppy on a fake.

## 4. Logos, monogram and typography

The monogram should be symmetrical, centred and aligned with the seams — on the great houses, a pattern is never cut off carelessly. The logo's typography (letter shapes, spacing) is a strong marker: fakes often give themselves away on a single letter detail or a rough alignment.

## 5. The hardware

Clasps, zips, buckles and rivets from a luxury house are heavy, well finished, with even plating, and often crisply engraved with the brand name. Metal that feels too light, or a blurry, sloppy engraving, should raise a flag. That said, on a vintage piece the hardware naturally patinas and dulls over time — that's normal, not a sign of a fake. Be wary above all of plating that flakes on a piece described as barely used. Zips often carry a maker's signature (Éclair, Lampo, YKK depending on the house and era).

## 6. Inside: lining, labels and heat stamp

Open the bag. The lining, sewn-in labels and heat stamp should be clean and consistent with the era of the model. Blurry printing, a poorly sewn label or a cheap lining material are all red flags.

## 7. Serial number, date code and chip

Many houses long used a discreet serial number or "date code". Careful: fakes have them too — a number alone proves nothing; it's its consistency (location, font, period-correct format) that counts. A recent technical point: since 2021, some houses (such as Louis Vuitton) have replaced the date code with a built-in RFID chip. A vintage piece, on the other hand, will have neither a chip nor a modern card — which is why you need criteria suited to its age.

## 8. Original accessories

Dustbag, box, padlock, card: they strengthen a case but prove nothing on their own, since they're faked too. And an invoice doesn't guarantee authenticity — it's easily forged. A coherent, good-quality set is a nice extra sign, not absolute proof.

## The special case of vintage

On an older piece, don't look for a modern authenticity card or a chip: focus on the leather, the stitching, the period hardware and the overall consistency. That's precisely where an expert eye and knowledge of the models make the difference.

## Should you have your bag authenticated?

Professional authentication (often between €50 and €170) can offer peace of mind on an expensive piece bought from a private seller. But the simplest route is to buy from a professional who checks every piece before it goes on sale — you save the stress and the cost of an appraisal.

> The best guarantee? Buying from a place that stakes its reputation on every piece.

## Buy with peace of mind at NOUVELLE RIVE

At NOUVELLE RIVE, every luxury piece is selected and verified before it goes on sale. Most come with a certificate, sometimes a certificate of origin, and may include their original dustbag or box. You buy with complete confidence, in store at 8 rue des Écouffes or online.`

const db = getFirestore()
const ref = db.collection('siteConfig').doc('_journal')
const snap = await ref.get()
const articles = snap.data().articles
for (const a of articles){
  if(a.slug==='reconnaitre-vrai-sac-luxe-vintage'){
    a.titleEn='How to spot a genuine vintage luxury bag'
    a.descriptionEn='Leather, stitching, hardware, serial number, dustbag: the complete guide to authenticating a vintage luxury bag and avoiding counterfeits.'
    a.categoryEn='GUIDE'
    a.bodyEn=bodyEn
    console.log('✓ EN rempli, mots:', bodyEn.split(/\s+/).length)
  }
}
await ref.set({ articles })
try{ await getStorage().bucket().file('_cache/journal.json.gz').delete() }catch{}
console.log('done')
process.exit(0)
