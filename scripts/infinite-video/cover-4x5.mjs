import { chromium } from 'playwright'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { trimToLocal } from './trim-images.mjs'

// usage: node cover-4x5.mjs "<NOM>" <output.png> <img1> <img2> <img3> <img4>
const NOM = process.argv[2]
const OUT = process.argv[3]
const srcs = process.argv.slice(4, 8)
const W = 1080, H = 1350, BLUE = '#22209C'

const imgs = await trimToLocal(srcs)   // pièces détourées du fond -> entières, propres

const html = `<!doctype html><html><head><meta charset="utf8"><style>
  *{margin:0;box-sizing:border-box;font-family:Helvetica,'Helvetica Neue',Arial,sans-serif}
  html,body{width:${W}px;height:${H}px;background:#fff;overflow:hidden}
  .col{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px}
  .row{display:flex;gap:40px;align-items:center;justify-content:center}
  .cell{width:470px;height:430px;display:flex;align-items:center;justify-content:center}
  .cell img{max-width:100%;max-height:100%;width:auto;height:auto;display:block}
  .title{text-align:center}
  .t{color:${BLUE};font-weight:600;font-size:44px;letter-spacing:.26em;padding-left:.26em}
  .t2{margin-top:14px}
</style></head><body>
  <div class="col">
    <div class="row"><div class="cell"><img src="${imgs[0]}"></div><div class="cell"><img src="${imgs[1]}"></div></div>
    <div class="title"><div class="t">NOUVELLE RIVE</div><div class="t t2">${NOM}</div></div>
    <div class="row"><div class="cell"><img src="${imgs[2]}"></div><div class="cell"><img src="${imgs[3]}"></div></div>
  </div>
</body></html>`

const tmp = join(dirname(OUT), '.tmp-cover.html')
writeFileSync(tmp, html)
const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await page.goto('file://' + tmp)
await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0), { timeout: 60000 })
await page.screenshot({ path: OUT })
await b.close()
import { rmSync } from 'fs'; rmSync(tmp, { force: true })
console.log('✓ cover 4:5', OUT)
