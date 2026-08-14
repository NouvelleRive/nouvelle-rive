// Prépare des reels IG en brouillon TikTok : download (yt-dlp+cookies) → réencode
// H.264 → upload Bunny → push TikTok inbox. Usage: node tiktok-prepare.mjs <url1> <url2> ...
import { execSync } from 'child_process'
import { reencodeForWeb, uploadBunny } from './lib/video-utils.mjs'

const urls = process.argv.slice(2)
if (!urls.length) { console.log('Donne au moins une URL IG'); process.exit(1) }

const shortcode = (u) => (u.match(/\/(?:reel|p)\/([^/?]+)/) || [])[1] || ('x' + Date.now())

for (const url of urls) {
  const id = shortcode(url)
  try {
    console.log(`\n▶ ${id}`)
    const raw = `/tmp/tk-${id}.mp4`
    execSync(`yt-dlp --cookies-from-browser chrome -o "${raw.replace('.mp4', '.%(ext)s')}" -f "bestvideo[ext=mp4]+bestaudio/best/best" --merge-output-format mp4 "${url}"`, { stdio: 'pipe' })
    const enc = `/tmp/tk-${id}-fs.mp4`
    reencodeForWeb(raw, enc)
    const bunny = await uploadBunny(enc, `videos/${id}-fs-${Date.now()}.mp4`)
    const res = await fetch('https://www.nouvellerive.eu/api/tiktok/publish', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl: bunny }),
    })
    const data = await res.json()
    console.log(data.success ? `  ✓ TikTok: ${data.status}` : `  ✗ ${data.error}`)
  } catch (e) {
    console.log(`  ✗ ${id}: ${(e.message || '').split('\n')[0].slice(0, 160)}`)
  }
}
process.exit(0)
