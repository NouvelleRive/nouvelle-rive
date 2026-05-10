import { addReelToChineuse } from './lib/video-utils.mjs'
for (const url of ['https://www.instagram.com/reel/DKg8rC4IqEO/', 'https://www.instagram.com/reel/DIHBoRNNVFp/']) {
  try {
    const u = await addReelToChineuse('sergio-tacchineur', url)
    console.log('✅', u)
  } catch (e) {
    console.log('⚠', url, '-', e.message?.slice(0, 60))
  }
}
process.exit(0)
