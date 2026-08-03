import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'

const W = 1080, H = 1920, PERIOD = 28, BLUE = '#22209C', NOM = 'STRASS CHRONIQUE'
const S = '/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad'
const OUTDIR = join(homedir(), 'Desktop', 'videos-ig-infinite')
const OUT = join(OUTDIR, 'infinite-strass-chronique-2rangs.mp4')

const prods = JSON.parse(readFileSync(join(S, 'cr-strass-chronique.json'), 'utf8')).produits.map(p => p.imageUrl).filter(Boolean)
const extra = JSON.parse(readFileSync(join(S, 'strc-extra.json'), 'utf8'))   // 5 pièces vendues

// mélange aléatoire + répartition alternée sur les 2 rangées (éclate les couleurs)
const all = [...prods, ...extra]
for (let k = all.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [all[k], all[j]] = [all[j], all[k]] }
const top = all.filter((_, i) => i % 2 === 0)
const bottom = all.filter((_, i) => i % 2 === 1)

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
const file = join(OUTDIR, '.tmp-strass.html')
writeFileSync(file, html)

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUTDIR, size: { width: W, height: H } }, deviceScaleFactor: 1 })
const pg = await ctx.newPage()
await pg.goto('file://' + file)
await pg.waitForFunction(() => { const el = [...document.images]; return el.length > 0 && el.every(i => i.complete && i.naturalWidth > 0) }, { timeout: 60000 })
await pg.waitForTimeout((PERIOD + 6) * 1000)
const vid = pg.video(); await ctx.close()
const webm = await vid.path()
execSync(`ffmpeg -y -ss 4 -t ${PERIOD} -i "${webm}" -vf "fps=30,scale=${W}:${H}:flags=lanczos,format=yuv420p" -c:v libx264 -profile:v high -preset slow -crf 18 -movflags +faststart -an "${OUT}"`, { stdio: 'ignore' })
execSync(`rm -f "${webm}" "${file}"`)
await b.close()
console.log(`✓ base strass (${all.length} tuiles : ${prods.length} produits + ${extra.length} vendues, période ${PERIOD}s)`)
