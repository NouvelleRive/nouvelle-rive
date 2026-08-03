import { execSync } from 'child_process'
import { chromium } from 'playwright'
import { homedir } from 'os'
import { join } from 'path'

const W = 1080, H = 1920, MARGIN = 470
const S = '/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad'
const OUTDIR = join(homedir(), 'Desktop', 'videos-ig-infinite')
const BASE = join(OUTDIR, 'infinite-casting-archives-2rangs.mp4')
const AUDIO = join(S, 'cas-final.m4a')
const OUT = join(OUTDIR, 'voix-casting-archives.mp4')

// timing = voix (Whisper FR), textes nettoyés (noms de maisons corrigés)
const segsFR = [
  [0.00, 4.54, "On a choisi de travailler avec Casting Archives parce qu'on voulait absolument avoir sa sélection dans la boutique."],
  [4.54, 10.00, "Elle collectionne les pièces d'archives des plus belles maisons de mode, entre autres"],
  [10.00, 13.70, "Yves Saint Laurent, Hermès, Yohji Yamamoto, Azzedine Alaïa, Issey Miyake."],
  [13.70, 17.92, "Son positionnement est évidemment écoresponsable, comme toutes les marques qu'on accueille chez NOUVELLE RIVE,"],
  [17.92, 23.68, "mais elle défend une vision de la mode au-delà de l'éthique : intemporelle, quiet et très pointue."],
  [23.68, 25.18, "C'est ça qu'on est allé chercher chez elle."],
  [25.18, 30.34, "Je pense que ses pièces préférées sont probablement celles de l'époque Martin Margiela chez Hermès,"],
  [30.34, 32.96, "ou peut-être les pièces architecturales d'Anne-Marie Beretta."],
  [32.96, 36.66, "Ce que j'adore avec sa sélection, c'est qu'elle ne chine que de très belles matières :"],
  [36.66, 42.60, "de la laine, du cachemire, de la soie. C'est pour ça qu'on est ravies de l'avoir en boutique, et aussi en ligne."],
]
const segsEN = [
  [0.00, 4.54, "We chose to work with Casting Archives because we absolutely wanted her selection in the shop."],
  [4.54, 10.00, "She collects archive pieces from the finest fashion houses, among others"],
  [10.00, 13.70, "Yves Saint Laurent, Hermès, Yohji Yamamoto, Azzedine Alaïa, Issey Miyake."],
  [13.70, 17.92, "Her approach is, of course, eco-responsible, like every brand we welcome at NOUVELLE RIVE,"],
  [17.92, 23.68, "but she stands for a vision of fashion beyond ethics: timeless, quiet and very sharp."],
  [23.68, 25.18, "That's what we came looking for."],
  [25.18, 30.34, "I think her favourite pieces are probably the Martin Margiela era at Hermès,"],
  [30.34, 32.96, "or maybe the architectural pieces by Anne-Marie Beretta."],
  [32.96, 36.66, "What I love about her selection is that she only sources beautiful materials:"],
  [36.66, 42.60, "wool, cashmere, silk. That's why we're so happy to have her in the shop, and online too."],
]

const buildCues = (segs, pos) => {
  const out = []
  for (const [from, to, txt] of segs) {
    const words = txt.split(' ').filter(Boolean)
    const weights = words.map(w => w.length + 1)
    const totW = weights.reduce((a, b) => a + b, 0)
    let t = from
    for (let k = 0; k < words.length; k++) { const s = t; t += (weights[k] / totW) * (to - from); out.push({ start: s, end: t, text: words[k], pos }) }
  }
  return out
}
const cues = [...buildCues(segsFR, 'top'), ...buildCues(segsEN, 'bottom')]

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const cssFor = pos => `*{margin:0;box-sizing:border-box;font-family:Helvetica,'Helvetica Neue',Arial,sans-serif}
  html,body{width:${W}px;height:${H}px;background:transparent;overflow:hidden}
  .wrap{position:absolute;left:0;right:0;${pos === 'top' ? `top:${MARGIN}px` : `bottom:${MARGIN}px`};display:flex;justify-content:center}
  .sub{background:rgba(0,0,0,.55);color:#fff;font-weight:400;font-size:32px;text-align:center;padding:9px 18px;border-radius:6px}`

const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
for (let i = 0; i < cues.length; i++) {
  await page.setContent(`<!doctype html><html><head><meta charset=utf8><style>${cssFor(cues[i].pos)}</style></head><body><div class="wrap"><div class="sub">${esc(cues[i].text)}</div></div></body></html>`)
  await page.screenshot({ path: join(OUTDIR, `.cue-${i}.png`), omitBackground: true })
}
await page.close(); await b.close()

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${AUDIO}"`).toString().trim())
const total = (dur + 0.5).toFixed(2)

// 0) base bouclée + voix (sans sous-titres)
let work = join(OUTDIR, '.work-ines-0.mp4')
execSync(`ffmpeg -y -stream_loop -1 -i "${BASE}" -i "${AUDIO}" -map 0:v -map 1:a -t ${total} -c:v libx264 -profile:v high -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k "${work}"`, { stdio: 'ignore' })

// 1) sous-titres par lots (ffmpeg limite le nombre d'entrées -> on chunk)
const CHUNK = 120
let pass = 1
for (let start = 0; start < cues.length; start += CHUNK, pass++) {
  const chunk = cues.slice(start, start + CHUNK)
  const next = join(OUTDIR, `.work-ines-${pass}.mp4`)
  const inputs = [`-i "${work}"`]
  chunk.forEach((_, i) => inputs.push(`-i "${join(OUTDIR, `.cue-${start + i}.png`)}"`))
  let fc = '', prev = '0:v'
  chunk.forEach((c, i) => { const o = i === chunk.length - 1 ? 'vout' : `t${i}`; fc += `[${prev}][${i + 1}:v]overlay=0:0:enable='between(t,${c.start.toFixed(2)},${c.end.toFixed(2)})'[${o}];`; prev = o })
  fc = fc.replace(/;$/, '')
  execSync(`ffmpeg -y ${inputs.join(' ')} -filter_complex "${fc}" -map "[vout]" -map 0:a -c:a copy -c:v libx264 -profile:v high -preset medium -crf 18 -pix_fmt yuv420p "${next}"`, { stdio: 'ignore' })
  execSync(`rm -f "${work}"`)
  work = next
}
execSync(`ffmpeg -y -i "${work}" -c copy -movflags +faststart "${OUT}"`, { stdio: 'ignore' })
execSync(`rm -f "${work}" "${join(OUTDIR, '.cue-')}"*.png`)
console.log('✓', OUT, `(${dur.toFixed(1)}s, FR+EN, ${cues.length} mots, ${pass - 1} lots)`)
