import { execSync } from 'child_process'
import { chromium } from 'playwright'
import { homedir } from 'os'
import { join } from 'path'

const W = 1080, H = 1920, MARGIN = 470
const S = '/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad'
const OUTDIR = join(homedir(), 'Desktop', 'videos-ig-infinite')
const BASE = join(OUTDIR, 'infinite-tete-dorange-2rangs.mp4')
const AUDIO = join(S, 'tdo-final.m4a')
const OUT = join(OUTDIR, 'voix-tete-dorange.mp4')

// timing = voix (Whisper FR, 1re "ce qu'on adore..." retirée).   = espace insécable
// -> "NOUVELLE RIVE" et "TÊTE D'ORANGE" restent en UN seul mot dans les sous-titres.
const segsFR = [
  [0.00, 3.48, "Il est plus que temps qu'on vous présente l'une de nos marques préférées chez"],
  [3.48, 7.28, "NOUVELLE RIVE : TÊTE D'ORANGE. Ce qu'on adore chez elle, c'est la douceur de"],
  [7.28, 11.44, "ses tons, ses lignes graphiques et épurées. Ses pièces upcyclées sont un"],
  [11.44, 14.72, "subtil mélange de matériaux, de styles et d'époques."],
  [14.72, 18.56, "Les designs ressemblent beaucoup à leur créatrice, Sarah. Des lignes"],
  [18.56, 22.48, "douces et réfléchies qui touchent en plein cœur. Déjà, ses bijoux portent le"],
  [22.48, 25.96, "nom de ses meilleures amies, et nous, on encourage tous les élans de sororité."],
  [25.96, 29.60, "Ensuite, ils touchent toujours nos cordes sensibles. Par exemple, l'une des"],
  [29.60, 33.08, "pièces qu'on adore, c'est le choker en perles. Elle s'inspire du bijou"],
  [33.08, 36.20, "phare des années 90-2000 — vous vous souvenez, celui en plastique qu'on avait"],
  [36.20, 39.08, "toutes. Mais là, elle en fait une version intemporelle, complètement"],
  [39.08, 42.52, "réinventée, avec des matières nobles. Ce genre de bijou, ce sont des petites"],
  [42.52, 46.44, "pépites qui nous rendent un peu nostalgiques, même si on n'est pas si vieilles."],
]
const segsEN = [
  [0.00, 3.48, "It's high time we introduced one of our favourite brands at"],
  [3.48, 7.28, "NOUVELLE RIVE: TÊTE D'ORANGE. What we love about her is the softness of"],
  [7.28, 11.44, "her tones, her clean, graphic lines. Her upcycled pieces are a"],
  [11.44, 14.72, "subtle mix of materials, styles and eras."],
  [14.72, 18.56, "The designs really look like their creator, Sarah. Soft,"],
  [18.56, 22.48, "thoughtful lines that hit you right in the heart. First, these pieces bear the"],
  [22.48, 25.96, "names of her best friends — and we're all for sisterhood."],
  [25.96, 29.60, "They also always strike a chord with us. For example, one of the"],
  [29.60, 33.08, "pieces we love is the pearl choker. It's inspired by the iconic"],
  [33.08, 36.20, "jewel of the 90s–2000s — remember, the plastic one we all"],
  [36.20, 39.08, "had. But here she makes a timeless version, completely"],
  [39.08, 42.52, "reinvented, with fine materials. These little"],
  [42.52, 46.44, "gems make us feel a bit nostalgic — even if we're not that old."],
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
