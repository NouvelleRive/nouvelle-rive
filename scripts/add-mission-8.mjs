import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('mission-vintage', 'https://www.instagram.com/reel/C9aFdHrtW4U/')
console.log('✅', url)
process.exit(0)
