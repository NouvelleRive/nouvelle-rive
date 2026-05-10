import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('dark-vintage', 'https://www.instagram.com/reel/CyT44oSLYPj/')
console.log('✅', url)
process.exit(0)
