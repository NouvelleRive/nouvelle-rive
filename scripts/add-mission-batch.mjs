import { addReelToChineuse } from './lib/video-utils.mjs'
for (const url of ['https://www.instagram.com/reel/DH3pKz8NpEW/', 'https://www.instagram.com/reel/DBej5KBAOP_/', 'https://www.instagram.com/reel/DFiOqQut4Ym/']) {
  try {
    const u = await addReelToChineuse('mission-vintage', url)
    console.log('✅', u)
  } catch (e) {
    console.log('⚠ skip', url, '-', e.message?.slice(0, 80))
  }
}
process.exit(0)
