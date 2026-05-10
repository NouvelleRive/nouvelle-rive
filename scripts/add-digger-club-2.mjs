import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('digger-club', 'https://www.instagram.com/reel/DVgtPkTiAUI/')
console.log('✅', url)
process.exit(0)
