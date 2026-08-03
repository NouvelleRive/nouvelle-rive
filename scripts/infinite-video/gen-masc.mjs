import { execSync } from 'child_process'
import { chromium } from 'playwright'
import { homedir } from 'os'
import { join } from 'path'

const W = 1080, H = 1920, MARGIN = 470
const S = '/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad'
const OUTDIR = join(homedir(), 'Desktop', 'videos-ig-infinite')
const BASE = join(OUTDIR, 'infinite-maison-mascarello-2rangs.mp4')
const AUDIO = join(S, 'masc-final.m4a')
const OUT = join(OUTDIR, 'voix-maison-mascarello.mp4')

// timing = voix (Whisper FR, montage sans clip du début), textes nettoyés
const segsFR = [
  [0.00, 2.88, "J'ai découvert Maison Mascarello sur Instagram, et honnêtement, mon cœur a fait un bond."],
  [2.88, 6.40, "Ça faisait longtemps que je n'avais pas vu un design aussi pointu pour un sac de jeune créatrice."],
  [6.40, 10.00, "Du coup je me suis renseignée : Camille les crée depuis son atelier à Marseille,"],
  [10.00, 11.88, "et heureusement, c'est de l'upcycling."],
  [11.88, 16.64, "Elle a choisi d'upcycler le cuir, un matériau noble et résistant, mais, comme vous savez, d'origine animale."],
  [16.64, 18.72, "Raison de plus pour le prendre de seconde main."],
  [18.72, 21.48, "Elle l'upcycle à partir de pièces chinées ou de chutes industrielles."],
  [21.48, 24.12, "Certaines racontent qu'on l'aurait même déjà vue découper des canapés."],
  [24.12, 27.40, "Vous avez des yeux, vous voyez : la forme de ces sacs est juste fantastique."],
  [27.40, 29.20, "Elle est inspirée des mousses de cyclistes."],
  [29.20, 32.64, "Moi personnellement, elle m'évoque plus les courbes du MuCEM."],
  [32.64, 33.40, "Et vous ?"],
]
const segsEN = [
  [0.00, 2.88, "I discovered Maison Mascarello on Instagram, and honestly, my heart skipped a beat."],
  [2.88, 6.40, "It had been a while since I'd seen such a sharp design from a young designer."],
  [6.40, 10.00, "So I looked into it: Camille makes them from her workshop in Marseille,"],
  [10.00, 11.88, "and thankfully, it's upcycling."],
  [11.88, 16.64, "She chose to upcycle leather — a noble, durable material, but, as you know, of animal origin."],
  [16.64, 18.72, "All the more reason to buy it second-hand."],
  [18.72, 21.48, "She upcycles it from thrifted pieces or industrial offcuts."],
  [21.48, 24.12, "Some say she's even been seen cutting up sofas."],
  [24.12, 27.40, "You have eyes, you can see: the shape of these bags is just fantastic."],
  [27.40, 29.20, "It's inspired by cyclists' saddles."],
  [29.20, 32.64, "Personally, it reminds me more of the curves of the MuCEM."],
  [32.64, 33.40, "And you?"],
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
