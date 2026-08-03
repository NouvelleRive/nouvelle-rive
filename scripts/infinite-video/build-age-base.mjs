import { chromium } from 'playwright'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'
import { trimToLocal } from './trim-images.mjs'

const W = 1080, H = 1920, PERIOD = 34, BLUE = '#22209C', NOM = 'ÂGE PARIS'
const S = '/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad'
const OUTDIR = join(homedir(), 'Desktop', 'videos-ig-infinite')
const OUT = join(OUTDIR, 'infinite-age-paris-2rangs.mp4')
const DESK = join(homedir(), 'Desktop')

// liste ordonnée (prio nouvelles + blazers d'avant, AGE231 short exclu)
let imgs = JSON.parse(readFileSync(join(S, 'age-ordered.json'), 'utf8')).filter(Boolean)
console.log(`→ ${imgs.length} tuiles blazers`)
imgs = await trimToLocal(imgs)

const half = Math.ceil(imgs.length / 2)
const top = imgs.slice(0, half), bottom = imgs.slice(half)
const css = `*{margin:0;box-sizing:border-box;font-family:Helvetica,'Helvetica Neue',Arial,sans-serif}
  html,body{width:${W}px;height:${H}px;background:#fff;overflow:hidden}
  .track{display:flex;width:max-content;height:100%}
  .r1{animation:mL ${PERIOD}s linear infinite}.r2{animation:mR ${PERIOD}s linear infinite}
  @keyframes mL{to{transform:translateX(-50%)}}@keyframes mR{from{transform:translateX(-50%)}to{transform:translateX(0)}}
  .cell{height:100%;flex:0 0 auto;padding:0 5px;background:#fff}.cell img{height:100%;width:auto;display:block}
  .logo{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;pointer-events:none}
  .t{color:${BLUE};font-weight:600;font-size:40px;letter-spacing:.30em;text-transform:uppercase;padding-left:.30em}.t2{margin-top:18px}`
const track = (arr, cls) => `<div class="track ${cls}">${[...arr, ...arr].map(u => `<div class="cell"><img src="${u}"></div>`).join('')}</div>`
const html = `<!doctype html><html><head><meta charset="utf8"><style>${css}</style></head><body>
  <div style="height:100%;display:flex;flex-direction:column">
    <div style="height:${H / 2}px;overflow:hidden;display:flex;align-items:center">${track(top, 'r1')}</div>
    <div style="height:${H / 2}px;overflow:hidden;display:flex;align-items:center">${track(bottom, 'r2')}</div>
  </div>
  <div class="logo"><div class="t">Nouvelle Rive</div><div class="t t2">${NOM}</div></div>
</body></html>`
const file = join(OUTDIR, '.tmp-age.html')
writeFileSync(file, html)

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUTDIR, size: { width: W, height: H } }, deviceScaleFactor: 1 })
const pg = await ctx.newPage()
await pg.goto('file://' + file)
await pg.waitForFunction(() => { const el = [...document.images]; return el.length > 0 && el.every(i => i.complete && i.naturalWidth > 0) }, { timeout: 60000 })
await pg.waitForTimeout((PERIOD + 6) * 1000)
const vid = pg.video(); await ctx.close()
const webm = await vid.path()
execSync(`ffmpeg -y -ss 4 -t ${PERIOD} -i "${webm}" -vf "fps=30,scale=${W}:${H}:flags=lanczos,format=yuv420p,setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709" -c:v libx264 -profile:v high -preset slow -crf 18 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart -an "${OUT}"`, { stdio: 'ignore' })
execSync(`rm -f "${webm}" "${file}"`)
await b.close()
console.log('✓ base Âge (blazers)', OUT)
