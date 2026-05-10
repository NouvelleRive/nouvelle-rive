import { addReelToChineuse } from './lib/video-utils.mjs'

const reels = [
  'https://www.instagram.com/reel/DDWzZ67NN3a/',
  'https://www.instagram.com/reel/DCyzxSKtvGZ/',
  'https://www.instagram.com/reel/DBq3HAQNPeN/',
]

for (const reel of reels) {
  console.log(`\n→ Ajout du reel ${reel}`)
  const url = await addReelToChineuse('pardon-pardon', reel)
  console.log('✅', url)
}

process.exit(0)
