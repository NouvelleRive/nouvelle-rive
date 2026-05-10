import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('frusques', 'https://www.instagram.com/reel/C8bwgy8COOu/')
console.log('✅', url)
process.exit(0)
