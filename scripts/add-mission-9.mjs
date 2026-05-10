import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('mission-vintage', 'https://www.instagram.com/reel/C769-9_N1Rr/')
console.log('✅', url)
process.exit(0)
