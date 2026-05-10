import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('sergio-tacchineur', 'https://www.instagram.com/reel/C2C4EZTNMFu/')
console.log('✅', url)
process.exit(0)
