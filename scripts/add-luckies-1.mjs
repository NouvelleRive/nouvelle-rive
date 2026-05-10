import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('nan-goldies', 'https://www.instagram.com/reel/DJFA3VuNwCn/')
console.log('✅', url)
process.exit(0)
