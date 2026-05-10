import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('diabolo-menthe', 'https://www.instagram.com/reel/DT5dR7XDGF0/')
console.log('✅', url)
process.exit(0)
