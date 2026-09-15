// v2 — couverture avec les nouvelles couleurs.
import { chromium } from 'playwright'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const W = 1080, H = 1920, BLUE = '#22209C', NOM = 'STRASS CHRONIQUE'
const OUTDIR = join(homedir(), 'Desktop', 'videos-ig-infinite')
const { dispo } = JSON.parse(readFileSync(join(OUTDIR, 'data', 'strass-v2.json'), 'utf8'))
// 4 nouveautés aux couleurs variées ; toutes en carré cover -> même taille
const PICK = ['STRC61', 'STRC59', 'STRC57', 'STRC58']
const pics = PICK.map(s => dispo.find(d => d.sku === s)?.img).filter(Boolean)

const OUT = process.argv[2] || join(OUTDIR, 'cover-strass-v2.png')
const SQ = 480

const html = `<!doctype html><html><head><meta charset="utf8"><style>
  *{margin:0;box-sizing:border-box;font-family:Helvetica,'Helvetica Neue',Arial,sans-serif}
  html,body{width:${W}px;height:${H}px;background:#fff;overflow:hidden}
  .col{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:44px}
  .row{display:flex;gap:24px}
  .sq{width:${SQ}px;height:${SQ}px;object-fit:cover;display:block}
  .title{text-align:center}
  .t1{color:${BLUE};font-weight:600;font-size:52px;letter-spacing:.28em;padding-left:.28em}
  .t2{color:${BLUE};font-weight:600;font-size:52px;letter-spacing:.28em;padding-left:.28em;margin-top:16px}
</style></head><body>
  <div class="col">
    <div class="row"><img class="sq" src="${pics[0]}"><img class="sq" src="${pics[1]}"></div>
    <div class="title"><div class="t1">NOUVELLE RIVE</div><div class="t2">${NOM}</div></div>
    <div class="row"><img class="sq" src="${pics[2]}"><img class="sq" src="${pics[3]}"></div>
  </div>
</body></html>`

const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await page.setContent(html)
await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0), { timeout: 60000 })
await page.screenshot({ path: OUT })
await b.close()
console.log('✓ couverture', OUT)
