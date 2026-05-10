import { addReelToChineuse } from './lib/video-utils.mjs'
for (const url of ['https://www.instagram.com/reel/DJ1tRnpIepN/', 'https://www.instagram.com/reel/DWzDSzHiqIW/']) {
  try {
    const u = await addReelToChineuse('the-parisian-vintage', url)
    console.log('✅', u)
  } catch (e) {
    console.log('⚠', url, '-', e.message?.slice(0, 60))
  }
}
process.exit(0)
