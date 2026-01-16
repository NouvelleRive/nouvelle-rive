import { v2 as cloudinary } from 'cloudinary'
import * as admin from 'firebase-admin'
import * as fs from 'fs'

const serviceAccount = JSON.parse(fs.readFileSync('./functions/serviceAccountKey.json', 'utf8'))
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  })
}

const db = admin.firestore()

async function main() {
  const snapshot = await db.collection('produits').get()
  const publicIds = new Set<string>()
  
  snapshot.docs.forEach((doc) => {
    const data = doc.data()
    
    const extractPublicId = (url: string) => {
      if (!url) return
      const match = url.match(/\/produits\/([^./?]+)/)
      if (match) publicIds.add(`produits/${match[1]}`)
    }
    
    if (data.imageUrl) extractPublicId(data.imageUrl)
    if (data.imageUrls) data.imageUrls.forEach(extractPublicId)
    if (data.photos) {
      if (data.photos.face) extractPublicId(data.photos.face)
      if (data.photos.faceOnModel) extractPublicId(data.photos.faceOnModel)
      if (data.photos.dos) extractPublicId(data.photos.dos)
      if (data.photos.details) data.photos.details.forEach(extractPublicId)
    }
  })

  const csvLines = ['public_id,resource_type,type,']
  publicIds.forEach(id => csvLines.push(`${id},image,upload,`))
  
  fs.writeFileSync('cloudinary-recovery.csv', csvLines.join('\n'))
  console.log(`✅ CSV créé: cloudinary-recovery.csv`)
  console.log(`📊 ${publicIds.size} images à restaurer`)
}

main().catch(console.error)
