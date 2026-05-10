import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('soir', 'https://www.instagram.com/reel/DVgsbPeDfGY/')
console.log('✅', url)
process.exit(0)
