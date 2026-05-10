import { addReelToChineuse } from './lib/video-utils.mjs'
for (const url of ['https://www.instagram.com/reel/DH3pKz8NpEW/', 'https://www.instagram.com/reel/DBej5KBAOP_/']) {
  const u = await addReelToChineuse('mission-vintage', url)
  console.log('✅', u)
}
process.exit(0)
