// mettre dans le champs marque les marques détectées à partir du nom du produit

import admin from 'firebase-admin'
import { readFileSync } from 'fs'

// Firebase
const serviceAccount = JSON.parse(readFileSync('./scripts/firebase-service-account.json', 'utf8'))
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

// Même liste que lib/marques.ts
const MARQUES = [
  'Chanel', 'Dior', 'Christian Dior', 'Louis Vuitton', 'Hermès', 'Hermes', 'Hemès',
  'Yves Saint Laurent', 'YSL', 'Saint Laurent', 'Celine', 'Céline',
  'Givenchy', 'Lanvin', 'Balmain', 'Balenciaga', 'Courrèges', 'Courreges',
  'Jean Paul Gaultier', 'JPG', 'Chloé', 'Chloe', 'Sonia Rykiel', 'Kenzo',
  'Thierry Mugler', 'Mugler', 'Pierre Cardin', 'Ungaro', 'Emanuel Ungaro',
  'Nina Ricci', 'Rochas', 'Jacquemus', 'Lemaire', 'Isabel Marant',
  'Agnès b', 'Agnes b', 'Zadig & Voltaire', 'Sézane', 'Claudie Pierlot',
  'Maje', 'Sandro', 'Bash', 'Ba&sh', 'Tara Jarmon', 'Vanessa Bruno',
  'Gucci', 'Prada', 'Versace', 'Valentino', 'Fendi', 'Bottega Veneta',
  'Dolce & Gabbana', 'D&G', 'Armani', 'Giorgio Armani', 'Emporio Armani',
  'Roberto Cavalli', 'Cavalli', 'Missoni', 'Moschino', 'Miu Miu',
  'Salvatore Ferragamo', 'Ferragamo', 'Tod\'s', 'Max Mara', 'Marni',
  'Etro', 'Emilio Pucci', 'Pucci', 'Loro Piana',
  'Burberry', 'Burberrys', 'Alexander McQueen', 'McQueen', 'Vivienne Westwood',
  'Stella McCartney', 'Paul Smith', 'Mulberry', 'Jimmy Choo',
  'Comme des Garçons', 'CDG', 'Yohji Yamamoto', 'Yamamoto', 'Issey Miyake',
  'Kansai Yamamoto', 'Sacai', 'Undercover',
  'Dries Van Noten', 'Van Noten', 'Martin Margiela', 'Margiela', 'Maison Margiela',
  'Ann Demeulemeester', 'Raf Simons',
  'Y-3', 'Y3', 'Adidas', 'Nike', 'Lacoste', 'Ralph Lauren', 'Polo Ralph Lauren',
  'Tommy Hilfiger', 'Calvin Klein', 'CK', 'The North Face', 'Carhartt',
  'Stüssy', 'Stussy', 'Supreme',
  'Chevignon', 'Plein Sud', 'Marithé + François Girbaud', 'Girbaud',
  'Claude Montana', 'Montana', 'Azzedine Alaïa', 'Alaïa', 'Alaia',
  'Loewe', 'Escada', 'Gérard Darel', 'Gerard Darel',
  'Longchamp', 'Cartier', 'Van Cleef',
  'Tiffany', 'Bulgari', 'Chopard', 'Swarovski',
]

const ALIASES = {
  'ysl': 'Yves Saint Laurent', 'saint laurent': 'Yves Saint Laurent',
  'christian dior': 'Dior', 'hemès': 'Hermès', 'hermes': 'Hermès',
  'burberrys': 'Burberry', 'mcqueen': 'Alexander McQueen',
  'van noten': 'Dries Van Noten', 'margiela': 'Maison Margiela',
  'martin margiela': 'Maison Margiela', 'cdg': 'Comme des Garçons',
  'yamamoto': 'Yohji Yamamoto', 'cavalli': 'Roberto Cavalli',
  'roberto cavalli': 'Roberto Cavalli', 'ferragamo': 'Salvatore Ferragamo',
  'd&g': 'Dolce & Gabbana', 'pucci': 'Emilio Pucci',
  'jpg': 'Jean Paul Gaultier', 'mugler': 'Thierry Mugler',
  'celine': 'Céline', 'céline': 'Céline', 'chloe': 'Chloé',
  'courreges': 'Courrèges', 'alaia': 'Azzedine Alaïa', 'alaïa': 'Azzedine Alaïa',
  'montana': 'Claude Montana', 'y3': 'Y-3', 'ck': 'Calvin Klein',
  'girbaud': 'Marithé + François Girbaud', 'bash': 'Ba&sh',
  'giorgio armani': 'Armani', 'emporio armani': 'Armani',
  'polo ralph lauren': 'Ralph Lauren', 'ungaro': 'Emanuel Ungaro',
  'louis vuitton': 'Louis Vuitton', 'lanvin': 'Lanvin',
}

const SORTED = [...new Set([...MARQUES, ...Object.keys(ALIASES)])]
  .sort((a, b) => b.length - a.length)

function normalize(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function detectMarque(titre) {
  const t = normalize(titre)
  for (const brand of SORTED) {
    const b = normalize(brand)
    const escaped = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\b${escaped}\\b`, 'i')
    if (regex.test(t)) {
      const canonical = ALIASES[brand.toLowerCase()] || brand
      return MARQUES.find(m => m.toLowerCase() === canonical.toLowerCase()) || canonical
    }
  }
  return null
}

async function main() {
  const snapshot = await db.collection('produits').get()
  console.log(`📦 ${snapshot.size} produits trouvés`)

  let updated = 0
  let skipped = 0
  let noMatch = 0
  const updates = []

  for (const doc of snapshot.docs) {
    const data = doc.data()
    
    // Skip si marque déjà remplie
    if (data.marque && data.marque.trim()) {
      skipped++
      continue
    }

    const nom = data.nom || ''
    const detected = detectMarque(nom)

    if (detected) {
      updates.push({ id: doc.id, nom, marque: detected })
    } else {
      noMatch++
    }
  }

  console.log(`\n📊 Résultat :`)
  console.log(`  ✅ Déjà rempli : ${skipped}`)
  console.log(`  🔍 Marque détectée : ${updates.length}`)
  console.log(`  ❓ Pas de match : ${noMatch}`)

  if (updates.length === 0) {
    console.log('\nRien à mettre à jour !')
    return
  }

  // Aperçu
  console.log(`\n📋 Aperçu (${Math.min(20, updates.length)} premiers) :`)
  updates.slice(0, 20).forEach(u => {
    console.log(`  ${u.nom} → ${u.marque}`)
  })

  // Demander confirmation
  const readline = await import('readline')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await new Promise(resolve => {
    rl.question(`\n🚀 Mettre à jour ${updates.length} produits ? (oui/non) `, resolve)
  })
  rl.close()

  if (answer !== 'oui') {
    console.log('❌ Annulé')
    return
  }

  // Batch update
  const BATCH_SIZE = 500
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = db.batch()
    const chunk = updates.slice(i, i + BATCH_SIZE)
    chunk.forEach(u => {
      batch.update(db.collection('produits').doc(u.id), { marque: u.marque })
    })
    await batch.commit()
    console.log(`  ✅ ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}`)
  }

  console.log(`\n🎉 ${updates.length} produits mis à jour !`)
}

main().catch(console.error)