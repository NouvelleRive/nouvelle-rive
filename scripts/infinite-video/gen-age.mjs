import { execSync } from 'child_process'
import { chromium } from 'playwright'
import { homedir } from 'os'
import { join } from 'path'

const W = 1080, H = 1920, MARGIN = 470
const S = '/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad'
const OUTDIR = join(homedir(), 'Desktop', 'videos-ig-infinite')
const BASE = join(OUTDIR, 'infinite-age-paris-2rangs.mp4')
const AUDIO = join(S, 'age-final.m4a')
const OUT = join(OUTDIR, 'voix-age-paris.mp4')

// timing = voix (Whisper FR, montage sans clip du début), textes nettoyés
const segsFR = [
  [0.00, 2.80, "Ce que j'adore chez Âge, c'est d'abord leur nom."],
  [2.80, 5.20, "Dans une société où l'on fait tout pour rester jeune,"],
  [5.20, 8.60, "la marque a décidé de mettre à l'honneur l'âge et de célébrer la valeur du temps."],
  [8.60, 10.00, "Merci pour le reminder."],
  [10.00, 13.20, "Rien à voir : on peut dire qu'Âge est spécialiste du blazer."],
  [13.20, 15.80, "Elle pioche cette pièce iconique dans le vestiaire masculin"],
  [15.80, 20.20, "et en quelques coups de ciseaux, la revisite en une pièce ultra féminine, ultra forte."],
  [20.20, 22.20, "Les designs sont plus canons les uns que les autres."],
  [22.20, 24.40, "Je vous invite à découvrir leur sublime collection."],
  [24.40, 30.28, "Il faudra choisir entre la version ajourée, corsetée, strassée… ou ne pas choisir."],
]
const segsEN = [
  [0.00, 2.80, "What I love about Âge is, first of all, their name."],
  [2.80, 5.20, "In a society where we do everything to stay young,"],
  [5.20, 8.60, "the brand chose to celebrate age and honour the value of time."],
  [8.60, 10.00, "Thanks for the reminder."],
  [10.00, 13.20, "On another note: Âge is a real blazer specialist."],
  [13.20, 15.80, "She takes this iconic piece from the men's wardrobe"],
  [15.80, 20.20, "and, in a few snips, reworks it into an ultra-feminine, ultra-strong piece."],
  [20.20, 22.20, "The designs are each more stunning than the last."],
  [22.20, 24.40, "I invite you to discover their gorgeous collection."],
  [24.40, 30.28, "You'll have to choose between the openwork, corseted or rhinestoned version… or not choose at all."],
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
const total = dur.toFixed(2)

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
