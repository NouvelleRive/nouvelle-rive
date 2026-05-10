import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('frusques', 'https://www.instagram.com/reel/DMkChmRC0Sd/')
console.log('✅', url)
process.exit(0)
