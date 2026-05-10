import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('diabolo-menthe', 'https://www.instagram.com/reel/DQSNGlWjHDI/')
console.log('✅', url)
process.exit(0)
