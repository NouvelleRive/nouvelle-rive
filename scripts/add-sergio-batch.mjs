import { addReelToChineuse } from './lib/video-utils.mjs'
for (const url of ['https://www.instagram.com/reel/DIHBoRNNVFp/', 'https://www.instagram.com/reel/DHtdwFRtAVY/']) {
  try {
    const u = await addReelToChineuse('sergio-tacchineur', url)
    console.log('✅', u)
  } catch (e) {
    console.log('⚠', url, '-', e.message?.slice(0, 80))
  }
}
process.exit(0)
