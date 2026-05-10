import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('nan-goldies', 'https://www.instagram.com/reel/DI8QMpnt1G3/')
console.log('✅', url)
process.exit(0)
