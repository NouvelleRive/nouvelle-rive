import { readFileSync } from 'fs'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
const zone=process.env.BUNNY_STORAGE_ZONE, key=process.env.BUNNY_API_KEY, cdn=process.env.NEXT_PUBLIC_BUNNY_CDN_URL
const path='journal/chiner-vintage-paris.jpg'
// conversion d'origine (orientation EXIF conservée, sans rotation manuelle)
const buf=readFileSync('/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/574b8f36-fb06-47a8-8294-2f5892431202/scratchpad/chiner.jpg')
const res=await fetch(`https://storage.bunnycdn.com/${zone}/${path}`,{method:'PUT',headers:{AccessKey:key,'Content-Type':'image/jpeg'},body:buf})
console.log(res.ok?'✓ ré-uploadée (sens d origine): '+cdn+'/'+path:'❌ '+res.status)
process.exit(0)
