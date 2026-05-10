import { addReelToChineuse } from './lib/video-utils.mjs'
for (const url of ['https://www.instagram.com/reel/DYE7BVcjXUu/', 'https://www.instagram.com/reel/DV6bz0qjSFn/']) {
  try {
    const u = await addReelToChineuse('soir', url)
    console.log('✅', u)
  } catch (e) {
    console.log('⚠', url, '-', e.message?.slice(0, 60))
  }
}
process.exit(0)
