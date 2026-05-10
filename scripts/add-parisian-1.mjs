import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('the-parisian-vintage', 'https://www.instagram.com/reel/DXqsuP2Cqif/')
console.log('✅', url)
process.exit(0)
