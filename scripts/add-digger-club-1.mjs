import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('digger-club', 'https://www.instagram.com/reel/DW-ujuwoPeK/')
console.log('✅', url)
process.exit(0)
