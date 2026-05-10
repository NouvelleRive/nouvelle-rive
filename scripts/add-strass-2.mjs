import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('strass-chronique', 'https://www.instagram.com/reel/DMKxP5DtoMq/')
console.log('✅', url)
process.exit(0)
