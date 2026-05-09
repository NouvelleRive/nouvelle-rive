// Pour chaque URL "instagram.com/reel/..." dans iconiques + chineuses :
// download via yt-dlp, upload sur Bunny, remplace l'URL.
// + cas spéciaux Top Ana : nouveau fichier HD (déjà trimé 2.5s)
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import https from 'https'

const sa = JSON.parse(readFileSync(new URL('./firebase-service-account.json', import.meta.url), 'utf8'))
if (!getApps().length) initializeApp({ credential: cert(sa) })
const db = getFirestore()

const BUNNY_KEY = '26a0a715-8178-492a-b7f062ba4e09-786a-46b4'
const TMP = '/tmp/insta-reel-conv'
execSync(`mkdir -p ${TMP}`)

async function uploadBunny(localPath, bunnyPath) {
  const buf = readFileSync(localPath)
  await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'storage.bunnycdn.com', port: 443,
      path: `/nouvellerive/${bunnyPath}`, method: 'PUT',
      headers: { 'AccessKey': BUNNY_KEY, 'Content-Type': 'video/mp4', 'Content-Length': buf.length },
    }, (res) => res.statusCode === 201 ? resolve() : reject(new Error('Upload: ' + res.statusCode)))
    req.on('error', reject); req.write(buf); req.end()
  })
  return `https://nouvellerive.b-cdn.net/${bunnyPath}`
}

// 1. Récupère toutes les URLs Insta dans Firestore
const colls = ['iconiques', 'chineuse']
const allInstaReels = new Set()
for (const c of colls) {
  const snap = await db.collection(c).get()
  snap.forEach(d => {
    for (const u of (d.data().videos || [])) {
      if (typeof u === 'string' && /instagram\.com\/reel\//i.test(u)) allInstaReels.add(u.split('?')[0].replace(/\/$/, '') + '/')
    }
  })
}
console.log(`${allInstaReels.size} reels Insta à convertir`)

// 2. Pour chaque reel : download + upload + collecte map
const map = {} // oldUrl → newUrl
for (const url of allInstaReels) {
  const id = url.match(/reel\/([^/?]+)/)[1]
  const localPath = `${TMP}/${id}.mp4`
  console.log(`\n→ ${id}`)
  if (!existsSync(localPath)) {
    try {
      execSync(`yt-dlp -o "${localPath}" -f "bestvideo[ext=mp4]+bestaudio/best" --merge-output-format mp4 "${url}" 2>&1 | tail -3`, { stdio: 'inherit' })
    } catch (e) {
      console.log(`  ⚠ download fail, skip`)
      continue
    }
  }
  const bunnyPath = `videos/${id}-${Date.now()}.mp4`
  const newUrl = await uploadBunny(localPath, bunnyPath)
  map[url] = newUrl
  console.log(`  ✅ → ${newUrl}`)
}

// 3. Mise à jour Firestore
for (const c of colls) {
  const snap = await db.collection(c).get()
  for (const d of snap.docs) {
    const v = d.data().videos || []
    const updated = v.map(u => {
      const norm = (u || '').split('?')[0].replace(/\/$/, '') + '/'
      return map[norm] || u
    })
    if (JSON.stringify(updated) !== JSON.stringify(v)) {
      await d.ref.update({ videos: updated })
      console.log(`  ✏️ ${c}/${d.id} videos updated`)
    }
  }
}
console.log('\n✅ Done')
process.exit(0)
