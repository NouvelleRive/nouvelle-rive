import { chromium } from 'playwright'
import { writeFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'

const W = 1080, H = 1920, DUR = 7.2, FPS = 30
const COLS = 3, STEP = 0.34
const TILE = W / COLS            // 360 : tuiles carrées
const BANNER = H - TILE * 5      // 120 : 5 rangs de tuiles + bande = 1920
const S = '/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/a05265f6-6187-4f2a-a586-0be02e4f2a71/scratchpad'
const DESK = join(homedir(), 'Desktop')
const OUT = join(S, 'closing-reveal.mp4')
const BLUE = '#22209C'

// tuiles 1..15 : d'abord le dossier permanent, sinon le Bureau (casse variable)
const STORE = join(DESK, 'videos-ig-infinite', 'closing-tiles')
const nameFor = n => {
  const stored = join(STORE, `closing-${n}.png`)
  if (existsSync(stored)) return stored
  const cands = n === 3 ? ['closing c', 'closing 3b', 'closing3b'] : [`closing ${n}`, `closing${n}`]
  for (const base of cands) for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'PNG', 'JPG']) {
    const p = join(DESK, `${base}.${ext}`); if (existsSync(p)) return p
  }
  return null
}
const tiles = []
for (let n = 1; n <= 15; n++) { const p = nameFor(n); if (!p) { console.error('⚠ manque tuile', n); process.exit(1) } tiles.push(p) }

// bande bleue entre rang 2 et rang 3
const cell = (i) => `<div class="cell"><img src="file://${tiles[i]}"></div>`
const rowsHtml = `
  <div class="grow r1">${cell(0)}${cell(1)}${cell(2)}</div>
  <div class="grow r1">${cell(3)}${cell(4)}${cell(5)}</div>
  <div class="banner"><div>8 rue des Écouffes, Paris le Marais</div><div>www.nouvellerive.eu</div></div>
  <div class="grow r2">${cell(6)}${cell(7)}${cell(8)}</div>
  <div class="grow r2">${cell(9)}${cell(10)}${cell(11)}</div>
  <div class="grow r2">${cell(12)}${cell(13)}${cell(14)}</div>`

let covers = ''
const rowsY = [0, TILE, TILE * 2, TILE * 2 + BANNER, TILE * 3 + BANNER, TILE * 4 + BANNER]
const rowsH = [TILE, TILE, BANNER, TILE, TILE, TILE]
for (let r = 0; r < 6; r++) for (let c = 0; c < COLS; c++) {
  covers += `<div class="cv" style="left:${c * TILE}px;top:${rowsY[r]}px;width:${TILE}px;height:${rowsH[r]}px;animation-delay:${(r * COLS + c) * STEP}s"></div>`
}

const html = `<!doctype html><html><head><meta charset="utf8"><style>
  *{margin:0;box-sizing:border-box;font-family:Helvetica,'Helvetica Neue',Arial,sans-serif}
  html,body{width:${W}px;height:${H}px;background:#fff;overflow:hidden}
  .card{position:absolute;inset:0;display:flex;flex-direction:column}
  .grow{display:flex;height:${TILE}px}
  .cell{width:${TILE}px;height:${TILE}px;overflow:hidden}
  .cell img{width:100%;height:100%;object-fit:cover;display:block}
  .banner{height:${BANNER}px;background:${BLUE};color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-weight:700;font-size:30px;line-height:1.3}
  .cv{position:absolute;background:#fff;opacity:1;animation:rev .4s ease forwards}
  @keyframes rev{to{opacity:0}}
</style></head><body>
  <div class="card">${rowsHtml}</div>
  ${covers}
</body></html>`
const file = join(S, '.closing-reveal.html')
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
console.log('✓ closing-reveal (tuiles carrées, grille exacte)', OUT)
