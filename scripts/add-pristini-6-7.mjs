import { addReelToChineuse } from './lib/video-utils.mjs'
const reels = [
  'https://www.instagram.com/reel/C5veH_rLW4c/',
  'https://www.instagram.com/reel/CyJLQfJNo97/',
]
for (const url of reels) {
  try {
    const u = await addReelToChineuse('pristini', url)
    console.log('✅', u)
  } catch (e) {
    console.log('⚠', url, '-', e.message?.slice(0, 60))
  }
}
process.exit(0)
