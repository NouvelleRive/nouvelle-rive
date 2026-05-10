import { addReelToChineuse } from './lib/video-utils.mjs'
const reels = [
  'https://www.instagram.com/reel/DJW6Y5VNONZ/',
  'https://www.instagram.com/reel/DIzFfFig7in/',
  'https://www.instagram.com/reel/DHx9wJnt58o/',
  'https://www.instagram.com/reel/DHl49RCNFNA/',
  'https://www.instagram.com/reel/DGgbVaPgBkh/',
]
for (const url of reels) {
  try {
    const u = await addReelToChineuse('pristini', url)
    console.log('✅', u)
  } catch (e) {
    console.log('⚠ skip', url, '-', e.message?.slice(0, 60))
  }
}
process.exit(0)
