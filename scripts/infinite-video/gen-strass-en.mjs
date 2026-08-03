import { execSync } from 'child_process'
import { chromium } from 'playwright'
import { homedir } from 'os'
import { join } from 'path'

const W = 1080, H = 1920, MARGIN = 470
const S = '/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad'
const OUTDIR = join(homedir(), 'Desktop', 'videos-ig-infinite')
const BASE = join(OUTDIR, 'infinite-strass-chronique-2rangs.mp4')
const AUDIO = join(S, 'strass-final.m4a')
const OUT = join(OUTDIR, 'voix-strass-chronique.mp4')

// mêmes fenêtres temporelles (calées sur la voix), FR (haut) + EN (bas)
const segsFR = [
  [0.00, 4.46, "On a choisi de travailler avec Strass Chronique, d'abord parce que le design est canon."],
  [4.46, 9.30, "Quand je vois ça, la gamine en moi se réveille — les froufrous, les couleurs,"],
  [9.30, 10.30, "c'est incroyable."],
  [10.30, 15.00, "Strass Chronique, c'est avant tout le travail d'Anna, dans son atelier à Marseille."],
  [15.00, 20.06, "Elle chine ses matières en friperie, ou carrément dans le monde de la déco —"],
  [20.06, 21.72, "des rideaux, des napperons."],
  [21.72, 25.52, "Elle utilise aussi des chutes industrielles et retravaille tout à la main."],
  [25.52, 27.24, "Donc chaque pièce est unique."],
  [27.24, 33.08, "Le sac se porte à l'épaule ou en crossbody —"],
  [33.08, 37.84, "il y a juste un petit nœud pour l'ajuster — trop malin. Et c'est très léger, un vrai plus pour un sac."],
  [37.84, 41.20, "Bref : sublime, fait main, responsable —"],
  [41.20, 43.60, "une pièce qu'il faut absolument avoir. C'est pour ça qu'on veut la distribuer."],
  [43.60, 44.60, "Merci Anna !"],
]
const segsEN = [
  [0.00, 4.46, "We chose to work with Strass Chronique first because the design is stunning."],
  [4.46, 9.30, "When I see it, the little girl in me wakes up — the frills, the colours,"],
  [9.30, 10.30, "it's incredible."],
  [10.30, 15.00, "Strass Chronique is above all the work of Anna, in her workshop in Marseille."],
  [15.00, 20.06, "She sources her materials from thrift shops, or even from home décor —"],
  [20.06, 21.72, "curtains, doilies."],
  [21.72, 25.52, "She also uses industrial offcuts and reworks them all by hand."],
  [25.52, 27.24, "So each piece is unique."],
  [27.24, 33.08, "The bag is worn on the shoulder or crossbody —"],
  [33.08, 37.84, "there's just a little knot to adjust it — so clever. And it's very light, a real plus for a bag."],
  [37.84, 41.20, "In short: gorgeous, hand made, responsible —"],
  [41.20, 43.60, "a piece you absolutely need. That's why we want to carry it."],
  [43.60, 44.60, "Thank you, Anna!"],
]

// mot par mot dans la fenêtre [from,to] de chaque phrase, avec position (top/bottom)
const buildCues = (segs, pos) => {
  const out = []
  for (const [from, to, txt] of segs) {
    const words = txt.split(' ').filter(Boolean)
    const weights = words.map(w => w.length + 1)
    const totW = weights.reduce((a, b) => a + b, 0)
    let t = from
    for (let k = 0; k < words.length; k++) {
      const start = t
      t += (weights[k] / totW) * (to - from)
      out.push({ start, end: t, text: words[k], pos })
    }
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
const inputs = [`-stream_loop -1 -i "${BASE}"`, `-i "${AUDIO}"`]
cues.forEach((_, i) => inputs.push(`-i "${join(OUTDIR, `.cue-${i}.png`)}"`))
let fc = '', prev = '0:v'
cues.forEach((c, i) => { const o = i === cues.length - 1 ? 'vout' : `t${i}`; fc += `[${prev}][${i + 2}:v]overlay=0:0:enable='between(t,${c.start.toFixed(2)},${c.end.toFixed(2)})'[${o}];`; prev = o })
fc = fc.replace(/;$/, '')
execSync(`ffmpeg -y ${inputs.join(' ')} -filter_complex "${fc}" -map "[vout]" -map 1:a -t ${total} -c:v libx264 -profile:v high -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "${OUT}"`, { stdio: ['ignore','ignore','inherit'] })
execSync(`rm -f "${join(OUTDIR, '.cue-')}"*.png`)
console.log('✓', OUT, `(${dur.toFixed(1)}s, FR+EN, ${cues.length} mots)`)
