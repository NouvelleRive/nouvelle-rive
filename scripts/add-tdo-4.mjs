import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('tete-dorange', 'https://www.instagram.com/reel/C8rXUmsihBf/')
console.log('✅', url)
process.exit(0)
