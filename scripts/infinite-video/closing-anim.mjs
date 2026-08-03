import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'
import { trimToLocal } from './trim-images.mjs'

const W = 1080, H = 1920, BLUE = '#1a1ab8', DUR = 7, FPS = 30, STEP = 0.40
const S = '/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad'
const OUT = join(S, 'closing-anim.mp4')
let tiles = JSON.parse(readFileSync(join(S, 'closing-tiles.json'), 'utf8')).slice(0, 15)
tiles = await trimToLocal(tiles)

// ordre d'apparition des 15 carrés (2 rangées / banniere / 3 rangées) top->bottom
const order = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
const tile = (u, k) => `<div class="t" style="animation-delay:${(order.indexOf(k) * STEP).toFixed(2)}s"><img src="${u}"></div>`
const row = (a, off) => `<div class="row">${a.map((u, j) => tile(u, off + j)).join('')}</div>`
const bannerDelay = (15 * STEP + 0.1).toFixed(2)
const html = `<!doctype html><html><head><meta charset="utf8"><style>
  *{margin:0;box-sizing:border-box;font-family:Helvetica,'Helvetica Neue',Arial,sans-serif}
  html,body{width:${W}px;height:${H}px;background:#fff;overflow:hidden}
  .col{display:flex;flex-direction:column}.row{display:flex}
  .t{width:360px;height:360px;overflow:hidden;opacity:0;transform:scale(.92);animation:pop .42s cubic-bezier(.22,1,.36,1) forwards}
  .t img{width:100%;height:100%;object-fit:cover;display:block}
  .banner{height:120px;background:${BLUE};display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;text-align:center;opacity:0;animation:fade .5s ease ${bannerDelay}s forwards}
  .b1{font-weight:700;font-size:34px}.b2{font-weight:700;font-size:34px;margin-top:6px}
  @keyframes pop{to{opacity:1;transform:scale(1)}}@keyframes fade{to{opacity:1}}
</style></head><body>
  <div class="col">
    ${row(tiles.slice(0, 3), 0)}
    ${row(tiles.slice(3, 6), 3)}
    <div class="banner"><div class="b1">8 rue des Écouffes, Paris le Marais</div><div class="b2">www.nouvellerive.eu</div></div>
    ${row(tiles.slice(6, 9), 6)}
    ${row(tiles.slice(9, 12), 9)}
    ${row(tiles.slice(12, 15), 12)}
  </div>
</body></html>`
const file = join(S, '.closing-anim.html')
writeFileSync(file, html)

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: S, size: { width: W, height: H } }, deviceScaleFactor: 1 })
const pg = await ctx.newPage()
await pg.goto('file://' + file)
await pg.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth > 0), { timeout: 60000 })
await pg.waitForTimeout(DUR * 1000)
const vid = pg.video(); await ctx.close()
const webm = await vid.path()
execSync(`ffmpeg -y -t ${DUR} -i "${webm}" -vf "fps=${FPS},scale=${W}:${H},setsar=1,format=yuv420p" -c:v libx264 -profile:v high -crf 18 -movflags +faststart -an "${OUT}"`, { stdio: 'ignore' })
execSync(`rm -f "${webm}" "${file}"`)
await b.close()
console.log('✓ closing-anim (cascade)', OUT)
