import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('brujas', 'https://www.instagram.com/reel/DWGaDg6CMj5/')
console.log('✅', url)
process.exit(0)
