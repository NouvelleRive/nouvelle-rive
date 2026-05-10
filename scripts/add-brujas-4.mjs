import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('brujas', 'https://www.instagram.com/reel/DWUONg6iKv9/')
console.log('✅', url)
process.exit(0)
