// v2 — base marquee Strass Chronique avec les NOUVELLES COULEURS reçues.
// L'ancienne (build-strass-base.mjs / infinite-strass-chronique-2rangs.mp4) est conservée.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'

const W = 1080, H = 1920, PERIOD = 28, BLUE = '#22209C', NOM = 'STRASS CHRONIQUE'
const OUTDIR = join(homedir(), 'Desktop', 'videos-ig-infinite')
const DATA = join(OUTDIR, 'data', 'strass-v2.json')
const OUT = join(OUTDIR, 'infinite-strass-chronique-v2-2rangs.mp4')

const { dispo, vendus } = JSON.parse(readFileSync(DATA, 'utf8'))
// Les 6 nouveautés en vedette + 6 vendues aux couleurs variées (densité de la bande).
const RENFORT = ['STRC46', 'STRC43', 'STRC41', 'STRC39', 'STRC34', 'STRC45']
const extra = RENFORT.map(s => vendus.find(v => v.sku === s)).filter(Boolean)
const all = [...dispo, ...extra].map(r => r.img)

// mélange aléatoire + répartition alternée sur les 2 rangées (éclate les couleurs)
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
const file = join(OUTDIR, '.tmp-strass-v2.html')
writeFileSync(file, html)

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: OUTDIR, size: { width: W, height: H } }, deviceScaleFactor: 1 })
const pg = await ctx.newPage()
await pg.goto('file://' + file)
await pg.waitForFunction(() => { const el = [...document.images]; return el.length > 0 && el.every(i => i.complete && i.naturalWidth > 0) }, { timeout: 60000 })
await pg.waitForTimeout((PERIOD + 6) * 1000)
const vid = pg.video(); await ctx.close()
const webm = await vid.path()
// bt709 : sinon le webm Playwright sort en bt470bg et IG rougit les couleurs.
execSync(`ffmpeg -y -ss 4 -t ${PERIOD} -i "${webm}" -vf "fps=30,scale=${W}:${H}:flags=lanczos,format=yuv420p,setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709" -c:v libx264 -profile:v high -preset slow -crf 18 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart -an "${OUT}"`, { stdio: 'ignore' })
execSync(`rm -f "${webm}" "${file}"`)
await b.close()
console.log(`✓ base strass v2 (${all.length} tuiles : ${dispo.length} nouveautés dispo + ${extra.length} vendues, période ${PERIOD}s)`)
