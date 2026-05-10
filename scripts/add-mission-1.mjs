import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('mission-vintage', 'https://www.instagram.com/reel/DPMT-bViIq4/')
console.log('✅', url)
process.exit(0)
