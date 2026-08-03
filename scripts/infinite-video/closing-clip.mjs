import { chromium } from 'playwright'
import { execSync } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'

const W = 1080, H = 1920, MARGIN = 470
const S = '/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad'
const CARD = join(S, 'closing-grid.png')
const AUDIO = join(S, 'closing.m4a')
const OUT = join(S, 'closing-clip.mp4')

const segsFR = [
  [0.00, 4.90, "À bientôt pour découvrir une nouvelle créatrice, encore plus talentueuse, encore plus engagée."],
  [4.90, 5.90, "Bisous !"],
]
const segsEN = [
  [0.00, 4.90, "See you soon to discover a new designer — even more talented, even more committed."],
  [4.90, 5.90, "Kisses!"],
]
const buildCues = (segs, pos) => { const out = []; for (const [from, to, txt] of segs) { const w = txt.split(' ').filter(Boolean); const wt = w.map(x => x.length + 1); const tot = wt.reduce((a, b) => a + b, 0); let t = from; for (let k = 0; k < w.length; k++) { const s = t; t += (wt[k] / tot) * (to - from); out.push({ start: s, end: t, text: w[k], pos }) } } return out }
const cues = [...buildCues(segsFR, 'top'), ...buildCues(segsEN, 'bottom')]

const dur = parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${AUDIO}"`).toString().trim())
// carte gardée telle quelle (aspect exact, pas d'étirement) + fondu visible depuis le blanc
// base = l'anim cascade (closing-reveal.mp4) + son
const base = join(S, '.closing-base.mp4')
execSync(`ffmpeg -y -i "${join(S, 'closing-reveal.mp4')}" -i "${AUDIO}" -t ${dur.toFixed(2)} -map 0:v -map 1:a -c:v libx264 -profile:v high -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k "${base}"`, { stdio: 'ignore' })

// sous-titres PNG
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const cssFor = pos => `*{margin:0;box-sizing:border-box;font-family:Helvetica,'Helvetica Neue',Arial,sans-serif}
  html,body{width:${W}px;height:${H}px;background:transparent;overflow:hidden}
  .wrap{position:absolute;left:0;right:0;${pos === 'top' ? `top:${MARGIN}px` : `bottom:${MARGIN}px`};display:flex;justify-content:center}
  .sub{background:rgba(0,0,0,.55);color:#fff;font-weight:400;font-size:32px;text-align:center;padding:9px 18px;border-radius:6px}`
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
for (let i = 0; i < cues.length; i++) { await page.setContent(`<!doctype html><html><head><meta charset=utf8><style>${cssFor(cues[i].pos)}</style></head><body><div class="wrap"><div class="sub">${esc(cues[i].text)}</div></div></body></html>`); await page.screenshot({ path: join(S, `.ccue-${i}.png`), omitBackground: true }) }
await page.close(); await b.close()

const inputs = [`-i "${base}"`]
cues.forEach((_, i) => inputs.push(`-i "${join(S, `.ccue-${i}.png`)}"`))
let fc = '', prev = '0:v'
cues.forEach((c, i) => { const o = i === cues.length - 1 ? 'vout' : `t${i}`; fc += `[${prev}][${i + 1}:v]overlay=0:0:enable='between(t,${c.start.toFixed(2)},${c.end.toFixed(2)})'[${o}];`; prev = o })
fc = fc.replace(/;$/, '')
execSync(`ffmpeg -y ${inputs.join(' ')} -filter_complex "${fc}" -map "[vout]" -map 0:a -c:a copy -c:v libx264 -profile:v high -crf 18 -pix_fmt yuv420p -movflags +faststart "${OUT}"`, { stdio: 'ignore' })
execSync(`rm -f "${base}" "${join(S, '.ccue-')}"*.png`)
console.log('✓ closing-clip', OUT, dur.toFixed(1) + 's')
