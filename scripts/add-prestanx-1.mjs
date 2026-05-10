import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('prestanx', 'https://www.instagram.com/reel/DLkkXTWMpvn/')
console.log('✅', url)
process.exit(0)
