import { execSync } from 'child_process'
import { chromium } from 'playwright'
import { homedir } from 'os'
import { join } from 'path'

const W = 1080, H = 1920, MARGIN = 470
const S = '/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad'
const OUTDIR = join(homedir(), 'Desktop', 'videos-ig-infinite')
const BASE = join(OUTDIR, 'infinite-digger-sister-2rangs.mp4')
const AUDIO = join(S, 'ds-clean.m4a')
const OUT = join(OUTDIR, 'voix-digger-sister.mp4')

const segsFR = [
  [0.00, 3.72, "Il y a des jours où on se lève, on pense recruter une créatrice, et en fait on recrute une amie."],
  [3.72, 6.64, "C'est le cas de Nejma, qui a fondé Digger Sister."],
  [6.64, 10.04, "Évidemment, la marque prône l'upcycling, puisque la nana est parfaite."],
  [10.04, 11.74, "Et puis, pas de neuf chez nous."],
  [11.74, 13.96, "Parlons français : qu'est-ce qu'on aime chez elle ?"],
  [13.96, 16.52, "Numéro 1, le top Ana, son best-seller."],
  [16.52, 18.44, "Celui qui est très sexy, tu le vois ?"],
  [18.44, 24.00, "Adapté aux fortes chaleurs, il maintient juste ce qu'il faut, si tu vois ce que je veux dire, et ils partent à toute vitesse."],
  [24.00, 27.04, "En même temps, les premiers prix sont à 45 € et c'est du fait main."],
  [27.04, 30.42, "Numéro 2, sa collection Ajar, on devrait toutes les collectionner."],
  [30.42, 34.28, "Tu les vois : ce sont de belles chemises cropées sur lesquelles elle ajoute des petits nœuds délicats."],
  [34.28, 40.12, "Best-seller également. Et pour finir, numéro 3 : la collection Habi, pour les jours drama."],
  [40.12, 42.58, "Celle avec les cœurs partout — moi, je l'adore."],
  [42.58, 44.16, "Je l'adore, je l'adore, je l'adore, je l'adore."],
  [44.16, 45.68, "Cœur sur toi Nejma."],
]
const segsEN = [
  [0.00, 3.72, "Some days you get up thinking you'll recruit a designer, and you actually recruit a friend."],
  [3.72, 6.64, "That's the case with Nejma, who founded Digger Sister."],
  [6.64, 10.04, "Of course, the brand is all about upcycling — because the girl is perfect."],
  [10.04, 11.74, "And nothing's new here."],
  [11.74, 13.96, "Let's be honest: what do we love about her?"],
  [13.96, 16.52, "Number 1, the Ana top, her best-seller."],
  [16.52, 18.44, "The one that's super sexy — you see it?"],
  [18.44, 24.00, "Made for the heat, holding just enough — if you know what I mean — and they sell in no time."],
  [24.00, 27.04, "At the same time, prices start at 45 € and it's handmade."],
  [27.04, 30.42, "Number 2, her Ajar collection — we should all collect them."],
  [30.42, 34.28, "You see them: beautiful cropped shirts onto which she adds delicate little bows."],
  [34.28, 40.12, "A best-seller too. And finally, number 3: the Habi collection, for the drama days."],
  [40.12, 42.58, "The one with hearts everywhere — I love it."],
  [42.58, 44.16, "I love it, I love it, I love it, I love it."],
  [44.16, 45.68, "Love you, Nejma."],
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

let work = join(OUTDIR, '.work-ds-0.mp4')
execSync(`ffmpeg -y -stream_loop -1 -i "${BASE}" -i "${AUDIO}" -map 0:v -map 1:a -t ${total} -c:v libx264 -profile:v high -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k "${work}"`, { stdio: 'ignore' })

const CHUNK = 120
let pass = 1
for (let start = 0; start < cues.length; start += CHUNK, pass++) {
  const chunk = cues.slice(start, start + CHUNK)
  const next = join(OUTDIR, `.work-ds-${pass}.mp4`)
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
