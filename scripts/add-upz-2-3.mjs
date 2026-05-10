import { addReelToChineuse } from './lib/video-utils.mjs'
for (const url of ['https://www.instagram.com/reel/DUqoZm0jOJU/', 'https://www.instagram.com/reel/DUTlpB6DhWu/']) {
  try {
    const u = await addReelToChineuse('upznshit', url)
    console.log('✅', u)
  } catch (e) {
    console.log('⚠', url, '-', e.message?.slice(0, 60))
  }
}
process.exit(0)
