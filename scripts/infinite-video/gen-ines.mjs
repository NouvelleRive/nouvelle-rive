import { execSync } from 'child_process'
import { chromium } from 'playwright'
import { homedir } from 'os'
import { join } from 'path'

const W = 1080, H = 1920, MARGIN = 470
const S = '/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad'
const OUTDIR = join(homedir(), 'Desktop', 'videos-ig-infinite')
const BASE = join(OUTDIR, 'infinite-ines-pineau-2rangs.mp4')
const AUDIO = join(S, 'ines-final.m4a')
const OUT = join(OUTDIR, 'voix-ines-pineau.mp4')

// timing = voix (Whisper FR, montage sans clip du début), textes nettoyés
const segsFR = [
  [0.00, 3.70, "Il était hors de question de lancer NOUVELLE RIVE sans distribuer Inès Pineau."],
  [3.70, 7.20, "Dans l'univers de la bijouterie responsable, Inès Pineau est incontournable."],
  [7.20, 10.70, "Pas besoin de trop expliquer, les images parlent d'elles-mêmes — la marque est sublime."],
  [10.70, 16.00, "Ça fait un moment qu'on évolue dans ce milieu, et on a rarement vu une marque arriver à ce niveau."],
  [16.00, 19.00, "Ce qui est très compliqué — et à la fois très stimulant — en upcycling,"],
  [19.00, 22.70, "c'est qu'on ne part pas d'une page blanche : on ne crée pas, on recrée."],
  [22.70, 27.00, "Et pourtant, pour bâtir une vraie marque, il faut un univers cohérent."],
  [27.00, 28.50, "Et ça, Inès le fait très bien."],
  [28.50, 31.90, "Elle intègre tout un tas d'éléments très surprenants dans ses designs."],
  [31.90, 37.30, "Plein de petits éléments métalliques : des boutons, des zips, des porte-clés, des cadenas,"],
  [37.30, 42.90, "même des couverts. Et aussi des éléments jetables, comme des tickets de métro par exemple."],
  [42.90, 47.70, "Elle démonte, elle nettoie, elle polit, puis elle remonte tout et en fait des pièces sublimes."],
  [47.70, 51.30, "Je ne sais pas comment ça marche dans sa tête, comment elle réussit ce petit miracle."],
  [51.30, 54.10, "Mais quand tu vois une pièce, tu sais que c'est une pièce Inès Pineau."],
  [54.10, 57.50, "Et pourtant, elle est faite d'éléments complètement différents."],
  [57.50, 60.30, "Certains viennent de la cuisine, d'autres du garage."],
  [60.30, 64.46, "Bref, cette marque est un petit miracle, et on est trop heureuses de la voir chez NOUVELLE RIVE."],
]
const segsEN = [
  [0.00, 3.70, "There was no way we'd launch NOUVELLE RIVE without carrying Inès Pineau."],
  [3.70, 7.20, "In responsible jewellery, Inès Pineau is a must."],
  [7.20, 10.70, "No need to explain much — the images speak for themselves. The brand is stunning."],
  [10.70, 16.00, "We've been in this world a while, and we've rarely seen a brand reach this level."],
  [16.00, 19.00, "What's so hard — and so exciting — about upcycling,"],
  [19.00, 22.70, "is that you don't start from a blank page: you don't create, you recreate."],
  [22.70, 27.00, "And yet, to build a real brand, you need a coherent world."],
  [27.00, 28.50, "And that, Inès does beautifully."],
  [28.50, 31.90, "She works all kinds of surprising elements into her designs."],
  [31.90, 37.30, "Lots of little metal bits: buttons, zips, keyrings, padlocks,"],
  [37.30, 42.90, "even cutlery. And disposable things too — metro tickets, for example."],
  [42.90, 47.70, "She takes it apart, cleans it, polishes it, then reassembles it into stunning pieces."],
  [47.70, 51.30, "I don't know how her mind works, how she pulls off this little miracle."],
  [51.30, 54.10, "But when you see a piece, you know it's an Inès Pineau."],
  [54.10, 57.50, "And yet it's made from completely different parts."],
  [57.50, 60.30, "Some come from the kitchen, others from the garage."],
  [60.30, 64.46, "In short, this brand is a little miracle — and we're so happy to have it at NOUVELLE RIVE."],
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
