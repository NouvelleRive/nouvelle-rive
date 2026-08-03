import { execSync } from 'child_process'
import { chromium } from 'playwright'
import { homedir } from 'os'
import { join } from 'path'

const W = 1080, H = 1920, MARGIN = 470
const S = '/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad'
const OUTDIR = join(homedir(), 'Desktop', 'videos-ig-infinite')
const BASE = join(OUTDIR, 'infinite-personal-seller-2rangs.mp4')
const AUDIO = join(S, 'ps-clean.m4a')
const OUT = join(OUTDIR, 'voix-personal-seller.mp4')

const segsFR = [
  [0.00, 3.04, "Il y a plusieurs choses que j'adore avec les pièces de luxe."],
  [3.04, 5.68, "Un : de manière évidente, la qualité des matériaux."],
  [5.68, 10.48, "Le travail souvent artisanal — ce sont les pièces les plus qualitatives, celles qui durent dans le temps."],
  [10.48, 12.48, "Ce sont donc les premières qu'il faut conserver."],
  [12.48, 17.44, "Deux : les acheteuses et acheteurs les payent cher, donc ils en prennent soin."],
  [17.44, 19.12, "Et c'est ça qui fait durer les pièces."],
  [19.12, 25.28, "Trois : les maisons de luxe créent souvent des histoires autour des pièces, et marquent des tournants de société."],
  [25.28, 30.96, "Le 2.55 de Chanel, par exemple — le premier qui a libéré les mains des femmes."],
  [30.96, 37.36, "Coco Chanel, qu'on l'apprécie ou non, a eu l'idée d'ajouter une longue chaîne en métal, pour le porter à l'épaule."],
  [37.36, 41.36, "Le jersey Chanel aussi, qui facilite le port du pantalon en 1920."],
  [41.36, 46.88, "Pour info, la loi interdisant le pantalon aux femmes n'a été abrogée officiellement qu'en 2013."],
  [46.88, 54.56, "Chanel encore, dans les années 50, qui destructure les tenues des femmes et les rend actives : monter en voiture, se lever, se baisser sans contrainte."],
  [54.56, 61.28, "Un peu plus tard, dans les années 60, Yves Saint Laurent invente le smoking féminin, alors que c'était le vêtement de pouvoir par excellence."],
  [61.28, 64.64, "Le bikini de Louis Réard, la mini-jupe de Mary Quant."],
  [64.64, 72.72, "Et plus récemment, un autre miracle du luxe : le premier homme noir à la tête d'une maison de mode, Virgil Abloh chez Louis Vuitton."],
  [72.72, 77.76, "Rendu possible grâce à l'avènement du streetwear et de la culture afro-américaine."],
  [77.76, 81.68, "Coco Chanel disait : « une mode qui ne descend pas dans la rue n'est pas une mode »."],
  [81.68, 85.84, "Moi, honnêtement, je ne sais pas si c'est la mode qui descend dans la rue, ou la rue qui fait la mode."],
  [85.84, 93.44, "Ce que je sais, c'est que ces pièces sont autant de petits témoins de notre histoire, de notre évolution — et que c'est incroyable de les collectionner."],
  [93.44, 98.48, "Bref, j'ai beaucoup parlé : le personal seller, c'est nous qui faisons la sélection, et elle est incroyable. Venez la voir."],
]
const segsEN = [
  [0.00, 3.04, "There are several things I love about luxury pieces."],
  [3.04, 5.68, "One: obviously, the quality of the materials."],
  [5.68, 10.48, "Often handcrafted — the finest pieces, the ones that last over time."],
  [10.48, 12.48, "So they're the first ones worth keeping."],
  [12.48, 17.44, "Two: buyers pay a lot for them, so they take good care of them."],
  [17.44, 19.12, "And that's what makes the pieces last."],
  [19.12, 25.28, "Three: luxury houses often build stories around their pieces, marking turning points in society."],
  [25.28, 30.96, "The Chanel 2.55, for instance — the first bag that freed women's hands."],
  [30.96, 37.36, "Coco Chanel, love her or not, had the idea to add a long metal chain, to wear it on the shoulder."],
  [37.36, 41.36, "Chanel's jersey too, which made wearing trousers easier back in 1920."],
  [41.36, 46.88, "For the record, the law banning women from wearing trousers was only officially repealed in 2013."],
  [46.88, 54.56, "Chanel again, in the 1950s, deconstructing women's clothing so they could move: getting into a car, standing, bending down freely."],
  [54.56, 61.28, "A little later, in the 1960s, Yves Saint Laurent invented the women's tuxedo, when it was the ultimate garment of power."],
  [61.28, 64.64, "The Louis Réard bikini, the Mary Quant mini-skirt."],
  [64.64, 72.72, "And more recently, another miracle of luxury: the first Black man to lead a fashion house, Virgil Abloh at Louis Vuitton."],
  [72.72, 77.76, "Made possible by the rise of streetwear and African-American culture."],
  [77.76, 81.68, "Coco Chanel used to say: “a fashion that doesn't reach the street isn't fashion.”"],
  [81.68, 85.84, "Honestly, I don't know if fashion goes down to the street, or the street makes fashion."],
  [85.84, 93.44, "What I know is that these pieces are little witnesses of our history, our evolution — and that collecting them is incredible."],
  [93.44, 98.48, "Anyway, I've talked a lot: with the personal seller, we make the selection, and it's amazing. Come see it."],
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

let work = join(OUTDIR, '.work-ps-0.mp4')
execSync(`ffmpeg -y -stream_loop -1 -i "${BASE}" -i "${AUDIO}" -map 0:v -map 1:a -t ${total} -c:v libx264 -profile:v high -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k "${work}"`, { stdio: 'ignore' })

const CHUNK = 120
let pass = 1
for (let start = 0; start < cues.length; start += CHUNK, pass++) {
  const chunk = cues.slice(start, start + CHUNK)
  const next = join(OUTDIR, `.work-ps-${pass}.mp4`)
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
