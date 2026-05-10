import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('cozines', 'https://www.instagram.com/reel/DTczYm5CLwt/')
console.log('✅', url)
process.exit(0)
