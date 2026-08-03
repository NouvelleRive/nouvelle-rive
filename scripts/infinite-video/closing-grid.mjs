import { chromium } from 'playwright'
import { readFileSync } from 'fs'
import { join } from 'path'
import { trimToLocal } from './trim-images.mjs'

const W = 1080, H = 1920, BLUE = '#1a1ab8'
const S = '/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad'
const OUT = join(S, 'closing-grid.png')
const tiles = JSON.parse(readFileSync(join(S, 'closing-tiles.json'), 'utf8')).slice(0, 15)

// carrés 360x360, cover -> tous identiques et alignés ; bandeau après la 2e rangée
const tile = u => `<div class="t"><img src="${u}"></div>`
const row = arr => `<div class="row">${arr.map(tile).join('')}</div>`
const html = `<!doctype html><html><head><meta charset="utf8"><style>
  *{margin:0;box-sizing:border-box;font-family:Helvetica,'Helvetica Neue',Arial,sans-serif}
  html,body{width:${W}px;height:${H}px;background:#fff;overflow:hidden}
  .col{display:flex;flex-direction:column}
  .row{display:flex}
  .t{width:360px;height:360px;overflow:hidden}
  .t img{width:100%;height:100%;object-fit:cover;display:block}
  .banner{height:120px;background:${BLUE};display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center}
  .b1{font-weight:700;font-size:34px}
  .b2{font-weight:700;font-size:34px;margin-top:6px}
</style></head><body>
  <div class="col">
    ${row(tiles.slice(0, 3))}
    ${row(tiles.slice(3, 6))}
    <div class="banner"><div class="b1">8 rue des Écouffes, Paris le Marais</div><div class="b2">www.nouvellerive.eu</div></div>
    ${row(tiles.slice(6, 9))}
    ${row(tiles.slice(9, 12))}
    ${row(tiles.slice(12, 15))}
  </div>
</body></html>`

const b = await chromium.launch()
const page = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 })
await page.setContent(html)
await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0), { timeout: 60000 })
await page.screenshot({ path: OUT })
await b.close()
console.log('✓ closing-grid', OUT)
