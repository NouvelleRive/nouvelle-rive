import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('brujas', 'https://www.instagram.com/reel/DUoNjA0CP8Q/')
console.log('✅', url)
process.exit(0)
