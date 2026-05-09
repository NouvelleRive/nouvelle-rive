// Génère un fichier Excel avec les fourchettes de prix recommandées
// pour les déposantes (extrait de src/lib/marquesDeposante.ts)
//
// Usage : node scripts/export-prix-deposante.mjs

import ExcelJS from 'exceljs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Données dupliquées depuis src/lib/marquesDeposante.ts (script standalone)
const MARQUES = [
  { nom: 'AGNÈS B.', prix: [] },
  { nom: 'ALAÏA', prix: [
    { c: 'Veste / Manteau', min: 200, max: 1500 },
    { c: 'Robe', min: 150, max: 1200 },
    { c: 'Jupe / Short', min: 100, max: 600 },
    { c: 'Haut / Chemise', min: 80, max: 400 },
    { c: 'Sac', min: 300, max: 2000 },
    { c: 'Souliers', min: 150, max: 800 },
  ]},
  { nom: 'ALEXANDER MCQUEEN', prix: [
    { c: 'Veste / Manteau', min: 150, max: 1200 },
    { c: 'Robe', min: 120, max: 1000 },
    { c: 'Souliers', min: 100, max: 600 },
  ]},
  { nom: 'ANN DEMEULEMEESTER', prix: [
    { c: 'Veste / Manteau', min: 100, max: 800 },
    { c: 'Robe', min: 80, max: 600 },
    { c: 'Pantalon', min: 80, max: 400 },
  ]},
  { nom: 'BALENCIAGA', prix: [
    { c: 'Veste / Manteau', min: 200, max: 1500 },
    { c: 'Robe', min: 150, max: 1000 },
    { c: 'Haut / Chemise', min: 80, max: 500 },
    { c: 'Pantalon', min: 100, max: 600 },
    { c: 'Sac', min: 400, max: 3000 },
    { c: 'Souliers', min: 150, max: 800 },
  ]},
  { nom: 'BALMAIN', prix: [
    { c: 'Veste / Manteau', min: 150, max: 1200 },
    { c: 'Robe', min: 120, max: 800 },
    { c: 'Jupe / Short', min: 80, max: 500 },
  ]},
  { nom: 'BOTTEGA VENETA', prix: [
    { c: 'Veste / Manteau', min: 200, max: 1500 },
    { c: 'Robe', min: 150, max: 1000 },
    { c: 'Pull / Gilet', min: 150, max: 800 },
    { c: 'Sac', min: 500, max: 3000 },
    { c: 'Souliers', min: 200, max: 1000 },
    { c: 'Petite maroquinerie', min: 200, max: 1200 },
  ]},
  { nom: 'BURBERRY', prix: [
    { c: 'Veste / Manteau', min: 150, max: 1000 },
    { c: 'Pull / Gilet', min: 80, max: 400 },
    { c: 'Sac', min: 200, max: 1500 },
  ]},
  { nom: 'CÉLINE', prix: [
    { c: 'Veste / Manteau', min: 200, max: 1200 },
    { c: 'Robe', min: 150, max: 800 },
    { c: 'Pantalon', min: 100, max: 600 },
    { c: 'Sac', min: 400, max: 2500 },
    { c: 'Souliers', min: 150, max: 700 },
    { c: 'Petite maroquinerie', min: 150, max: 800 },
  ]},
  { nom: 'CHANEL', prix: [
    { c: 'Veste / Manteau', min: 300, max: 2500 },
    { c: 'Robe', min: 200, max: 1800 },
    { c: 'Jupe / Short', min: 150, max: 800 },
    { c: 'Haut / Chemise', min: 80, max: 600 },
    { c: 'Pantalon', min: 150, max: 800 },
    { c: 'Pull / Gilet', min: 200, max: 1200 },
    { c: 'Sac', min: 800, max: 8000 },
    { c: 'Souliers', min: 200, max: 1200 },
    { c: 'Collier', min: 100, max: 3000 },
    { c: 'Bracelet', min: 100, max: 3000 },
    { c: 'Broche', min: 100, max: 3000 },
    { c: "Boucles d'oreilles", min: 100, max: 3000 },
  ]},
  { nom: 'CHLOÉ', prix: [
    { c: 'Veste / Manteau', min: 100, max: 800 },
    { c: 'Robe', min: 80, max: 600 },
    { c: 'Sac', min: 200, max: 1500 },
  ]},
  { nom: 'CHRISTIAN DIOR', prix: [
    { c: 'Veste / Manteau', min: 250, max: 2000 },
    { c: 'Robe', min: 200, max: 1500 },
    { c: 'Jupe / Short', min: 120, max: 700 },
    { c: 'Haut / Chemise', min: 80, max: 500 },
    { c: 'Pantalon', min: 120, max: 700 },
    { c: 'Pull / Gilet', min: 150, max: 1000 },
    { c: 'Sac', min: 600, max: 6000 },
    { c: 'Souliers', min: 150, max: 1000 },
    { c: 'Collier', min: 80, max: 2000 },
    { c: 'Bracelet', min: 80, max: 2000 },
    { c: 'Broche', min: 80, max: 2000 },
    { c: "Boucles d'oreilles", min: 80, max: 2000 },
  ]},
  { nom: 'COMME DES GARÇONS', prix: [
    { c: 'Veste / Manteau', min: 100, max: 800 },
    { c: 'Robe', min: 80, max: 600 },
    { c: 'Pantalon', min: 80, max: 400 },
  ]},
  { nom: 'COURRÈGES', prix: [
    { c: 'Veste / Manteau', min: 80, max: 600 },
    { c: 'Robe', min: 80, max: 500 },
    { c: 'Jupe / Short', min: 60, max: 300 },
  ]},
  { nom: 'DOLCE & GABBANA', prix: [{ c: 'Petite maroquinerie', min: 80, max: 600 }]},
  { nom: 'DRIES VAN NOTEN', prix: [
    { c: 'Veste / Manteau', min: 100, max: 800 },
    { c: 'Robe', min: 80, max: 600 },
    { c: 'Pantalon', min: 80, max: 400 },
  ]},
  { nom: 'EMILIO PUCCI', prix: [
    { c: 'Robe', min: 80, max: 600 },
    { c: 'Haut / Chemise', min: 60, max: 300 },
  ]},
  { nom: 'FENDI', prix: [{ c: 'Petite maroquinerie', min: 150, max: 1500 }]},
  { nom: 'GIORGIO ARMANI', prix: [
    { c: 'Veste / Manteau', min: 80, max: 800 },
    { c: 'Pantalon', min: 60, max: 400 },
  ]},
  { nom: 'GIVENCHY', prix: [
    { c: 'Veste / Manteau', min: 100, max: 1000 },
    { c: 'Robe', min: 100, max: 800 },
    { c: 'Sac', min: 200, max: 1500 },
  ]},
  { nom: 'GUCCI', prix: [
    { c: 'Veste / Manteau', min: 200, max: 1500 },
    { c: 'Robe', min: 150, max: 1000 },
    { c: 'Sac', min: 400, max: 3000 },
    { c: 'Souliers', min: 150, max: 800 },
    { c: 'Ceinture', min: 150, max: 600 },
    { c: 'Collier', min: 100, max: 1000 },
    { c: 'Bracelet', min: 100, max: 1000 },
    { c: 'Broche', min: 100, max: 1000 },
    { c: "Boucles d'oreilles", min: 100, max: 1000 },
  ]},
  { nom: 'HELMUT LANG', prix: [
    { c: 'Veste / Manteau', min: 80, max: 500 },
    { c: 'Pantalon', min: 60, max: 300 },
  ]},
  { nom: 'HERMÈS', prix: [
    { c: 'Sac', min: 1500, max: 15000 },
    { c: 'Foulard', min: 150, max: 800 },
    { c: 'Ceinture', min: 150, max: 600 },
    { c: 'Veste / Manteau', min: 400, max: 3000 },
    { c: 'Collier', min: 200, max: 3000 },
    { c: 'Bracelet', min: 200, max: 3000 },
    { c: 'Broche', min: 200, max: 3000 },
    { c: "Boucles d'oreilles", min: 200, max: 3000 },
    { c: 'Petite maroquinerie', min: 300, max: 2000 },
  ]},
  { nom: 'ISABEL MARANT', prix: [
    { c: 'Veste / Manteau', min: 80, max: 600 },
    { c: 'Robe', min: 60, max: 400 },
    { c: 'Souliers', min: 60, max: 350 },
  ]},
  { nom: 'ISSEY MIYAKE', prix: [
    { c: 'Veste / Manteau', min: 80, max: 600 },
    { c: 'Robe', min: 80, max: 500 },
  ]},
  { nom: 'JACQUEMUS', prix: [
    { c: 'Robe', min: 80, max: 500 },
    { c: 'Haut / Chemise', min: 60, max: 300 },
    { c: 'Sac', min: 150, max: 800 },
  ]},
  { nom: 'JEAN PAUL GAULTIER', prix: [
    { c: 'Veste / Manteau', min: 150, max: 1500 },
    { c: 'Robe', min: 120, max: 1000 },
    { c: 'Jupe / Short', min: 80, max: 500 },
    { c: 'Haut / Chemise', min: 60, max: 400 },
  ]},
  { nom: 'JUNYA WATANABE', prix: [
    { c: 'Veste / Manteau', min: 100, max: 600 },
    { c: 'Robe', min: 80, max: 400 },
  ]},
  { nom: 'KENZO', prix: [
    { c: 'Veste / Manteau', min: 60, max: 400 },
    { c: 'Pull / Gilet', min: 50, max: 300 },
  ]},
  { nom: 'LANVIN', prix: [{ c: 'Petite maroquinerie', min: 80, max: 500 }]},
  { nom: 'LEMAIRE', prix: [
    { c: 'Veste / Manteau', min: 100, max: 800 },
    { c: 'Pantalon', min: 80, max: 400 },
    { c: 'Sac', min: 200, max: 1000 },
  ]},
  { nom: 'LOEWE', prix: [
    { c: 'Veste / Manteau', min: 150, max: 1000 },
    { c: 'Robe', min: 120, max: 800 },
    { c: 'Sac', min: 400, max: 2000 },
    { c: 'Petite maroquinerie', min: 150, max: 800 },
  ]},
  { nom: 'LOUIS VUITTON', prix: [
    { c: 'Sac', min: 600, max: 5000 },
    { c: 'Petite maroquinerie', min: 200, max: 1500 },
    { c: 'Veste / Manteau', min: 200, max: 1500 },
    { c: 'Souliers', min: 150, max: 800 },
  ]},
  { nom: 'MARGIELA', prix: [
    { c: 'Veste / Manteau', min: 150, max: 1000 },
    { c: 'Robe', min: 100, max: 700 },
    { c: 'Haut / Chemise', min: 60, max: 400 },
    { c: 'Pantalon', min: 80, max: 500 },
    { c: 'Sac', min: 200, max: 1200 },
  ]},
  { nom: 'MARINE SERRE', prix: [
    { c: 'Robe', min: 80, max: 500 },
    { c: 'Haut / Chemise', min: 60, max: 300 },
  ]},
  { nom: 'MAX MARA', prix: [
    { c: 'Veste / Manteau', min: 150, max: 1200 },
    { c: 'Souliers', min: 80, max: 400 },
  ]},
  { nom: 'MISSONI', prix: [
    { c: 'Robe', min: 80, max: 600 },
    { c: 'Pull / Gilet', min: 80, max: 500 },
  ]},
  { nom: 'MIU MIU', prix: [
    { c: 'Veste / Manteau', min: 150, max: 1000 },
    { c: 'Robe', min: 120, max: 800 },
    { c: 'Jupe / Short', min: 100, max: 500 },
    { c: 'Sac', min: 300, max: 1500 },
    { c: 'Souliers', min: 150, max: 700 },
  ]},
  { nom: 'MONCLER', prix: [{ c: 'Veste / Manteau', min: 300, max: 2000 }]},
  { nom: 'NINA RICCI', prix: [
    { c: 'Robe', min: 60, max: 400 },
    { c: 'Veste / Manteau', min: 80, max: 500 },
  ]},
  { nom: 'PACO RABANNE', prix: [
    { c: 'Robe', min: 80, max: 600 },
    { c: 'Haut / Chemise', min: 60, max: 300 },
  ]},
  { nom: 'PRADA', prix: [
    { c: 'Veste / Manteau', min: 200, max: 1500 },
    { c: 'Robe', min: 150, max: 1000 },
    { c: 'Sac', min: 400, max: 3000 },
    { c: 'Souliers', min: 150, max: 800 },
    { c: 'Petite maroquinerie', min: 150, max: 800 },
  ]},
  { nom: 'RICK OWENS', prix: [
    { c: 'Veste / Manteau', min: 150, max: 1200 },
    { c: 'Pantalon', min: 100, max: 600 },
    { c: 'Souliers', min: 150, max: 800 },
  ]},
  { nom: 'ROBERTO CAVALLI', prix: [
    { c: 'Robe', min: 80, max: 600 },
    { c: 'Veste / Manteau', min: 100, max: 700 },
  ]},
  { nom: 'SACAI', prix: [
    { c: 'Veste / Manteau', min: 100, max: 800 },
    { c: 'Robe', min: 80, max: 500 },
  ]},
  { nom: 'SAINT LAURENT', prix: [
    { c: 'Veste / Manteau', min: 200, max: 1500 },
    { c: 'Robe', min: 150, max: 800 },
    { c: 'Jupe / Short', min: 100, max: 500 },
    { c: 'Haut / Chemise', min: 80, max: 400 },
    { c: 'Pantalon', min: 100, max: 600 },
    { c: 'Sac', min: 400, max: 2500 },
    { c: 'Ceinture', min: 100, max: 500 },
    { c: 'Collier', min: 80, max: 800 },
    { c: 'Bracelet', min: 80, max: 800 },
    { c: 'Broche', min: 80, max: 800 },
    { c: "Boucles d'oreilles", min: 80, max: 800 },
  ]},
  { nom: 'SCHIAPARELLI', prix: [
    { c: 'Veste / Manteau', min: 200, max: 2000 },
    { c: 'Robe', min: 150, max: 1500 },
    { c: 'Collier', min: 100, max: 1000 },
    { c: 'Bracelet', min: 100, max: 1000 },
    { c: 'Broche', min: 100, max: 1000 },
    { c: "Boucles d'oreilles", min: 100, max: 1000 },
  ]},
  { nom: 'STELLA MCCARTNEY', prix: [
    { c: 'Veste / Manteau', min: 100, max: 800 },
    { c: 'Robe', min: 80, max: 600 },
    { c: 'Sac', min: 150, max: 800 },
  ]},
  { nom: 'THE ROW', prix: [
    { c: 'Veste / Manteau', min: 200, max: 2000 },
    { c: 'Pantalon', min: 150, max: 800 },
    { c: 'Sac', min: 400, max: 3000 },
  ]},
  { nom: 'THIERRY MUGLER', prix: [
    { c: 'Veste / Manteau', min: 200, max: 2000 },
    { c: 'Robe', min: 150, max: 1500 },
    { c: 'Jupe / Short', min: 100, max: 600 },
    { c: 'Haut / Chemise', min: 80, max: 400 },
    { c: 'Pantalon', min: 100, max: 600 },
  ]},
  { nom: 'VALENTINO', prix: [
    { c: 'Veste / Manteau', min: 150, max: 1500 },
    { c: 'Robe', min: 150, max: 1200 },
    { c: 'Sac', min: 300, max: 2000 },
    { c: 'Souliers', min: 150, max: 800 },
  ]},
  { nom: 'VERSACE', prix: [
    { c: 'Veste / Manteau', min: 150, max: 1200 },
    { c: 'Robe', min: 120, max: 800 },
    { c: 'Collier', min: 80, max: 600 },
    { c: 'Bracelet', min: 80, max: 600 },
    { c: 'Broche', min: 80, max: 600 },
    { c: "Boucles d'oreilles", min: 80, max: 600 },
  ]},
  { nom: 'VIVIENNE WESTWOOD', prix: [
    { c: 'Veste / Manteau', min: 100, max: 800 },
    { c: 'Robe', min: 80, max: 600 },
    { c: 'Collier', min: 50, max: 400 },
    { c: 'Bracelet', min: 50, max: 400 },
    { c: 'Broche', min: 50, max: 400 },
    { c: "Boucles d'oreilles", min: 50, max: 400 },
  ]},
  { nom: 'YOHJI YAMAMOTO', prix: [
    { c: 'Veste / Manteau', min: 100, max: 1000 },
    { c: 'Pantalon', min: 80, max: 500 },
  ]},
  { nom: 'YVES SAINT LAURENT', prix: [
    { c: 'Veste / Manteau', min: 100, max: 800 },
    { c: 'Robe', min: 80, max: 600 },
  ]},
  { nom: 'ZIMMERMANN', prix: [
    { c: 'Robe', min: 80, max: 600 },
    { c: 'Haut / Chemise', min: 60, max: 300 },
  ]},
]

const wb = new ExcelJS.Workbook()
wb.creator = 'Nouvelle Rive'
wb.created = new Date()

// ==========================================
// Feuille 1 — Format détaillé : 1 ligne par couple (marque, catégorie)
// ==========================================
const ws1 = wb.addWorksheet('Détail (long)')
ws1.columns = [
  { header: 'Marque', key: 'marque', width: 28 },
  { header: 'Catégorie', key: 'categorie', width: 24 },
  { header: 'Prix min (€)', key: 'min', width: 14 },
  { header: 'Prix max (€)', key: 'max', width: 14 },
]
ws1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
ws1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22209C' } }
ws1.getRow(1).alignment = { vertical: 'middle' }

for (const m of MARQUES) {
  if (!m.prix || m.prix.length === 0) {
    ws1.addRow({ marque: m.nom, categorie: '— pas de fourchette définie —', min: '', max: '' })
  } else {
    for (const p of m.prix) {
      ws1.addRow({ marque: m.nom, categorie: p.c, min: p.min, max: p.max })
    }
  }
}
ws1.views = [{ state: 'frozen', ySplit: 1 }]
ws1.autoFilter = { from: 'A1', to: 'D1' }
ws1.getColumn(3).numFmt = '#,##0 "€"'
ws1.getColumn(4).numFmt = '#,##0 "€"'

// ==========================================
// Feuille 2 — Format pivot : marques en lignes, catégories en colonnes
// ==========================================
const ws2 = wb.addWorksheet('Pivot (large)')
const allCats = Array.from(new Set(MARQUES.flatMap(m => (m.prix || []).map(p => p.c)))).sort((a, b) => a.localeCompare(b, 'fr'))

ws2.columns = [
  { header: 'Marque', key: 'marque', width: 28 },
  ...allCats.map(c => ({ header: c, key: c, width: 18 })),
]
ws2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
ws2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22209C' } }
ws2.getRow(1).alignment = { vertical: 'middle', wrapText: true }

for (const m of MARQUES) {
  const row = { marque: m.nom }
  for (const cat of allCats) {
    const p = (m.prix || []).find(x => x.c === cat)
    row[cat] = p ? `${p.min}–${p.max}` : ''
  }
  ws2.addRow(row)
}
ws2.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]

// Style alterné
ws1.eachRow((row, i) => {
  if (i === 1) return
  if (i % 2 === 0) {
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8FF' } }
  }
})
ws2.eachRow((row, i) => {
  if (i === 1) return
  if (i % 2 === 0) {
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F8FF' } }
  }
})

const outPath = path.join(process.cwd(), 'prix-deposante.xlsx')
await wb.xlsx.writeFile(outPath)
console.log(`✅ Fichier créé : ${outPath}`)
console.log(`   Feuille 1 "Détail (long)" : 1 ligne par (marque, catégorie)`)
console.log(`   Feuille 2 "Pivot (large)" : marques en lignes × catégories en colonnes`)
console.log(`   ${MARQUES.length} marques · ${MARQUES.reduce((s, m) => s + (m.prix?.length || 0), 0)} fourchettes`)
