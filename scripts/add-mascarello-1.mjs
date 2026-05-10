import { addReelToChineuse } from './lib/video-utils.mjs'
const url = await addReelToChineuse('maison-mascarello', 'https://www.instagram.com/p/DXrkLigjJ4d/')
console.log('✅', url)
process.exit(0)
