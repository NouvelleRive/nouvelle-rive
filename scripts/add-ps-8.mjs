import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('personal-seller', 'https://www.instagram.com/reel/DQHevuvAha3/')
console.log('✅', url)
process.exit(0)
