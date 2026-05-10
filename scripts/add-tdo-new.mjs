import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('tete-dorange', 'https://www.instagram.com/reel/DDhXhrksp6W/')
console.log('✅', url)
process.exit(0)
