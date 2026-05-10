import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('tete-dorange', 'https://www.instagram.com/reel/DKhft9VtJJ7/')
console.log('✅', url)
process.exit(0)
