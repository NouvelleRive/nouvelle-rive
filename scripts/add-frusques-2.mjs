import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('frusques', 'https://www.instagram.com/reel/DP_XK6Kgvs8/')
console.log('✅', url)
process.exit(0)
