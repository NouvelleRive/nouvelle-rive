import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'

const W = 1080, H = 1920, DUR = 7, FPS = 30
const BLUE = '#1a1ab8'
const S = '/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad'
const OUT = join(S, 'closing-visual.mp4')
const tiles = JSON.parse(readFileSync(join(S, 'closing-tiles.json'), 'utf8'))  // 15

// grille 3 colonnes x 5 rangées = 15 tuiles, cover, plein cadre
const cell = tiles.map(u => `<div class="cell"><img src="${u}"></div>`).join('')
const html = `<!doctype html><html><head><meta charset="utf8"><style>
  *{margin:0;box-sizing:border-box;font-family:Helvetica,'Helvetica Neue',Arial,sans-serif}
  html,body{width:${W}px;height:${H}px;background:#fff;overflow:hidden}
  .grid{width:${W}px;height:${H}px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(5,1fr)}
  .cell{overflow:hidden}.cell img{width:100%;height:100%;object-fit:cover;display:block}
  .banner{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);background:${BLUE};
          padding:34px 20px;text-align:center;color:#fff;
          opacity:0;animation:appear .7s cubic-bezier(.22,1,.36,1) .3s forwards}
  .l1{font-weight:700;font-size:40px;letter-spacing:.02em;
      opacity:0;transform:translateY(14px);animation:up .6s cubic-bezier(.22,1,.36,1) .5s forwards}
  .l2{font-weight:700;font-size:40px;letter-spacing:.06em;margin-top:12px;
      opacity:0;transform:translateY(14px);animation:up .6s cubic-bezier(.22,1,.36,1) .75s forwards}
  @keyframes appear{to{opacity:1}}
  @keyframes up{to{opacity:1;transform:translateY(0)}}
</style></head><body>
  <div class="grid">${cell}</div>
  <div class="banner"><div class="l1">8 rue des Écouffes, Paris le Marais</div><div class="l2">www.nouvellerive.eu</div></div>
</body></html>`
const file = join(S, '.closing.html')
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
console.log('✓ closing-visual', OUT)
