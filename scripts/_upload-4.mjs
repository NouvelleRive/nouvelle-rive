import { readFileSync } from 'fs'
import { config } from 'dotenv'
config({ path: '/Users/salomekassabi/Desktop/nouvelle-rive/.env.local' })
const zone=process.env.BUNNY_STORAGE_ZONE, key=process.env.BUNNY_API_KEY, cdn=process.env.NEXT_PUBLIC_BUNNY_CDN_URL
const SP='/private/tmp/claude-501/-Users-salomekassabi-Desktop-nouvelle-rive/574b8f36-fb06-47a8-8294-2f5892431202/scratchpad'
for(const k of ['A','B','C','D']){
  const path=`journal/chiner-${k}.jpg`
  const r=await fetch(`https://storage.bunnycdn.com/${zone}/${path}`,{method:'PUT',headers:{AccessKey:key,'Content-Type':'image/jpeg'},body:readFileSync(`${SP}/chiner_${k}.jpg`)})
  console.log(k, r.ok?`✓ ${cdn}/${path}`:`❌ ${r.status}`)
}
process.exit(0)
