import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('strass-chronique', 'https://www.instagram.com/reel/DQbzSmVCNv-/')
console.log('✅', url)
process.exit(0)
