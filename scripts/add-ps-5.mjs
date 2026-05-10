import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('personal-seller', 'https://www.instagram.com/reel/DSIE_-VAgrV/')
console.log('✅', url)
process.exit(0)
