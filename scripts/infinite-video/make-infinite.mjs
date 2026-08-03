#!/usr/bin/env node
/**
 * Génère les vidéos "infinite casting" (bandeau infini vertical 1080x1920) pour une chineuse.
 *
 * Prérequis (une seule fois) :
 *   cd scripts/infinite-video && npm install playwright && npx playwright install chromium
 *   (ffmpeg doit être installé : brew install ffmpeg)
 *
 * Exemples :
 *   # 20 pièces les plus récentes, muet, 2 rangées + 1 rangée
 *   node make-infinite.mjs frusques
 *
 *   # toutes les pièces
 *   node make-infinite.mjs strass-chronique --all
 *
 *   # pièces précises dans un ordre imposé (par SKU)
 *   node make-infinite.mjs casting-archives --skus "CAS10 CAS3 CAS2 CAS32 CAS24"
 *
 *   # seulement la version 2 rangées
 *   node make-infinite.mjs brujas --layout 2rangs
 *
 *   # avec ta voix + sous-titres mot par mot (fichier audio + texte lu)
 *   node make-infinite.mjs casting-archives --skus "CAS10 CAS3" \
 *        --voice "~/Downloads/voix off Casting Archives.m4a" --text ./casting.txt
 *
 * Options :
 *   --all                toutes les pièces (sinon 20 plus récentes)
 *   --skus "A B C"       liste de SKU dans l'ordre voulu (prioritaire sur --all)
 *   --layout both|2rangs|1rang   (défaut both)
 *   --voice <fichier>    audio à intégrer (m4a/mp4/wav...) ; sinon muet
 *   --text  <fichier>    texte lu -> sous-titres mot par mot (nécessite --voice)
 *   --out   <dossier>    sortie (défaut ~/Desktop/videos-ig-infinite)
 *   --base  <url>        base API (défaut https://www.nouvellerive.eu ; --local pour http://127.0.0.1:3000)
 *   --local              raccourci base = http://127.0.0.1:3000 (serveur dev)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { execSync } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'
import { trimToLocal } from './trim-images.mjs'

let chromium
try { ({ chromium } = await import('playwright')) }
catch { console.error('❌ Playwright manquant. Fais :\n   cd scripts/infinite-video && npm install playwright && npx playwright install chromium'); process.exit(1) }

// ---------- args ----------
const argv = process.argv.slice(2)
const slug = argv[0]
if (!slug || slug.startsWith('--')) { console.error('Usage: node make-infinite.mjs <slug-chineuse> [options] — voir en-tête du fichier'); process.exit(1) }
const opt = (name, def = null) => { const i = argv.indexOf('--' + name); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : def }
const ALL = !!opt('all')
const SKUS = typeof opt('skus') === 'string' ? opt('skus').trim().split(/\s+/) : null
const LAYOUT = (opt('layout', 'both') || 'both')
const VOICE = typeof opt('voice') === 'string' ? opt('voice').replace(/^~/, homedir()) : null
const TEXT = typeof opt('text') === 'string' ? opt('text').replace(/^~/, homedir()) : null
const OUT = (typeof opt('out') === 'string' ? opt('out') : join(homedir(), 'Desktop', 'videos-ig-infinite')).replace(/^~/, homedir())
const BASE = opt('local') ? 'http://127.0.0.1:3000' : (typeof opt('base') === 'string' ? opt('base') : 'https://www.nouvellerive.eu')

const W = 1080, H = 1920, BLUE = '#22209C'
const PERIOD_2 = 34, PERIOD_1 = 48
mkdirSync(OUT, { recursive: true })

// ---------- data ----------
async function getJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + ' -> ' + r.status); return r.json() }
async function getText(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + ' -> ' + r.status); return r.text() }

console.log(`→ chineuse: ${slug} | base: ${BASE}`)
const page0 = await getJSON(`${BASE}/api/creatrice-page?slug=${encodeURIComponent(slug)}`)
const NOM = (typeof opt('nom') === 'string' ? opt('nom') : (page0.chineuse?.nom || slug)).toUpperCase()

let imgs
if (SKUS) {
  // mapping SKU -> image via le flux Google
  const xml = await getText(`${BASE}/api/google-feed`)
  const map = {}
  for (const it of xml.split('<item>').slice(1)) {
    const id = (it.match(/<g:id>([^<]*)<\/g:id>/) || [])[1]
    const img = (it.match(/<g:image_link>([^<]*)<\/g:image_link>/) || [])[1]
    if (id) map[id.trim()] = (img || '').trim()
  }
  const miss = SKUS.filter(s => !map[s])
  if (miss.length) console.warn('⚠️  SKU absents du flux (ignorés):', miss.join(', '))
  imgs = SKUS.map(s => map[s]).filter(Boolean)
} else {
  const all = (page0.produits || []).map(p => p.imageUrl).filter(Boolean)
  imgs = ALL ? all : all.slice(0, 20)
}
if (imgs.length === 0) { console.error('❌ aucune image trouvée'); process.exit(1) }
// --bust : force le CDN à recharger (contourne une image encore en cache)
if (opt('bust')) { const cb = Date.now(); imgs = imgs.map(u => u + (u.includes('?') ? '&' : '?') + 'cb=' + cb) }
console.log(`→ ${imgs.length} pièces`)
// crop auto du fond (sauf --notrim) -> objet collé au bord, espacement régulier
if (!opt('notrim')) { imgs = await trimToLocal(imgs) }

// ---------- rendu visuel ----------
const cssFor = (period) => `
  *{margin:0;box-sizing:border-box;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif}
  html,body{width:${W}px;height:${H}px;background:#fff;overflow:hidden}
  .track{display:flex;width:max-content;height:100%}
  .r1{animation:mL ${period}s linear infinite}.r2{animation:mR ${period}s linear infinite}
  @keyframes mL{to{transform:translateX(-50%)}}@keyframes mR{from{transform:translateX(-50%)}to{transform:translateX(0)}}
  .cell{height:100%;flex:0 0 auto;padding:0 5px;background:#fff}.cell img{height:100%;width:auto;display:block}
  .logo{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;pointer-events:none}
  .t{color:${BLUE};font-weight:600;font-size:40px;letter-spacing:.30em;text-transform:uppercase;padding-left:.30em}
  .t2{margin-top:18px}`
const track = (arr, cls) => `<div class="track ${cls}">${[...arr, ...arr].map(u => `<div class="cell"><img src="${u}"></div>`).join('')}</div>`
const logo = `<div class="logo"><div class="t">Nouvelle Rive</div><div class="t t2">${NOM}</div></div>`
const wrap = (inner, period) => `<!doctype html><html><head><meta charset="utf8"><style>${cssFor(period)}</style></head><body>${inner}</body></html>`

const half = Math.ceil(imgs.length / 2)
const html2 = wrap(`<div style="height:100%;display:flex;flex-direction:column">
  <div style="height:${H / 2}px;overflow:hidden;display:flex;align-items:center">${track(imgs.slice(0, half), 'r1')}</div>
  <div style="height:${H / 2}px;overflow:hidden;display:flex;align-items:center">${track(imgs.slice(half).length ? imgs.slice(half) : imgs.slice(0, half), 'r2')}</div>
</div>${logo}`, PERIOD_2)
const html1 = wrap(`<div style="height:100%;display:flex;align-items:center;justify-content:center">
  <div style="height:1180px;overflow:hidden;display:flex;align-items:center;width:100%">${track(imgs, 'r1')}</div>
</div>${logo}`, PERIOD_1)

const browser = await chromium.launch()
async function renderBase(html, period, out) {
  const file = join(OUT, `.tmp-${out}.html`)
  writeFileSync(file, html)
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUT, size: { width: W, height: H } }, deviceScaleFactor: 1 })
  const pg = await ctx.newPage()
  await pg.goto('file://' + file)
  await pg.waitForFunction(() => { const el = [...document.images]; return el.length > 0 && el.every(i => i.complete && i.naturalWidth > 0) }, { timeout: 60000 })
  await pg.waitForTimeout((period + 6) * 1000)
  const vid = pg.video(); await ctx.close()
  const webm = await vid.path()
  const dst = join(OUT, out)
  execSync(`ffmpeg -y -ss 4 -t ${period} -i "${webm}" -vf "fps=30,scale=${W}:${H}:flags=lanczos,format=yuv420p" -c:v libx264 -profile:v high -preset slow -crf 18 -movflags +faststart -an "${dst}"`, { stdio: 'ignore' })
  execSync(`rm -f "${webm}" "${file}"`)
  return dst
}

// ---------- voix + sous-titres mot par mot (optionnel) ----------
async function addVoice(baseVideo) {
  const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${VOICE}"`).toString().trim())
  const cues = TEXT ? readFileSync(TEXT, 'utf8').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean) : []
  const inputs = [`-stream_loop -1 -i "${baseVideo}"`, `-i "${VOICE}"`]
  let fc = '', prev = '0:v', total = (dur + 0.6).toFixed(2)

  if (cues.length) {
    const weights = cues.map(c => c.length + 1)
    const totalW = weights.reduce((a, b) => a + b, 0)
    let t = 0
    const times = cues.map((c, i) => { const s = t; t += (weights[i] / totalW) * dur; return { text: c, start: s, end: t } })
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const css = `*{margin:0;box-sizing:border-box;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif}
      html,body{width:${W}px;height:${H}px;background:transparent;overflow:hidden}
      .wrap{position:absolute;left:0;right:0;bottom:470px;display:flex;justify-content:center}
      .sub{background:rgba(0,0,0,.55);color:#fff;font-weight:400;font-size:32px;text-align:center;padding:9px 18px;border-radius:6px}`
    const pg = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
    for (let i = 0; i < times.length; i++) {
      await pg.setContent(`<!doctype html><html><head><meta charset=utf8><style>${css}</style></head><body><div class="wrap"><div class="sub">${esc(times[i].text)}</div></div></body></html>`)
      await pg.screenshot({ path: join(OUT, `.cue-${i}.png`), omitBackground: true })
    }
    await pg.close()
    times.forEach((_, i) => inputs.push(`-i "${join(OUT, `.cue-${i}.png`)}"`))
    times.forEach((c, i) => { const o = i === times.length - 1 ? 'vout' : `t${i}`; fc += `[${prev}][${i + 2}:v]overlay=0:0:enable='between(t,${c.start.toFixed(2)},${c.end.toFixed(2)})'[${o}];`; prev = o })
    fc = fc.replace(/;$/, '')
  }

  const out = join(OUT, `voix-${slug}.mp4`)
  const vmap = cues.length ? `-filter_complex "${fc}" -map "[vout]"` : `-map 0:v`
  execSync(`ffmpeg -y ${inputs.join(' ')} ${vmap} -map 1:a -t ${total} -c:v libx264 -profile:v high -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "${out}"`, { stdio: 'ignore' })
  execSync(`rm -f "${join(OUT, '.cue-')}"*.png 2>/dev/null || true`)
  console.log('✓', out)
}

// ---------- exécution ----------
let base2, base1
if (LAYOUT === 'both' || LAYOUT === '2rangs') { base2 = await renderBase(html2, PERIOD_2, `infinite-${slug}-2rangs.mp4`); console.log('✓', base2) }
if (LAYOUT === 'both' || LAYOUT === '1rang') { base1 = await renderBase(html1, PERIOD_1, `infinite-${slug}-1rang.mp4`); console.log('✓', base1) }
if (VOICE) await addVoice(base2 || base1)
await browser.close()
console.log(`\n✅ terminé → ${OUT}`)
