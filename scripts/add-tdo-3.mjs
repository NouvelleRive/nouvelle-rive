import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('tete-dorange', 'https://www.instagram.com/reel/DHd_Am5s8ht/')
console.log('✅', url)
process.exit(0)
