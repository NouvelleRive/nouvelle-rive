import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('mission-vintage', 'https://www.instagram.com/reel/C_yKGuQAB6x/')
console.log('✅', url)
process.exit(0)
