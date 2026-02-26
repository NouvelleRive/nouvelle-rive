// app/api/analyze-product/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELES } from '@/lib/modeles'
import { MOTIFS } from '@/lib/motifs'
import { COLOR_PALETTE } from '@/lib/couleurs'

// Options pour les champs secondaires
const SLEEVE_LENGTHS = ['Sans manches', 'Bretelles', 'Manches courtes', 'Manches 3/4', 'Manches longues']
const COLLAR_TYPES = ['Col V', 'Col rond', 'Col montant', 'Col roulé', 'Col chemise', 'Col Mao', 'Col claudine', 'Capuche', 'Sans col']
const GARMENT_LENGTHS = ['Mini', 'Mi-cuisse', 'Genou', 'Mi-mollet', 'Longue', 'Ras du sol']
const CLOSURE_TYPES = ['Boutons', 'Zip', 'Lacets', 'Pression', 'Ceinture', 'Enfilable', 'Crochets']
const SHOE_TYPES = ['Talon', 'Botte', 'Bottine', 'Basket', 'Mocassin', 'Sandale', 'Escarpin', 'Ballerine', 'Mule', 'Derby', 'Compensé']

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, nom, marque, categorie, matiere, taille, madeIn } = await req.json()

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl requis' }, { status: 400 })
    }

    // Déterminer les options de modèle selon la catégorie
    const categorieLower = (categorie || '').toLowerCase()
    let typeModele: string | null = null
    let optionsModele: string[] = []

    if (['pantalon', 'jean', 'jogging', 'legging', 'short'].some(c => categorieLower.includes(c))) {
      typeModele = 'pantalon'
      optionsModele = MODELES.pantalon
    } else if (categorieLower.includes('jupe')) {
      typeModele = 'jupe'
      optionsModele = MODELES.jupe
    } else if (['robe', 'combinaison'].some(c => categorieLower.includes(c))) {
      typeModele = 'robe'
      optionsModele = MODELES.robe
    } else if (['veste', 'manteau', 'blouson', 'blazer', 'parka', 'doudoune', 'trench', 'cape'].some(c => categorieLower.includes(c))) {
      typeModele = 'veste'
      optionsModele = MODELES.veste
    }

    // Couleurs disponibles
    const couleurs = COLOR_PALETTE.map(c => c.name)

    // Déterminer les champs secondaires selon la catégorie
    const isHaut = ['top', 'chemise', 'blouse', 'pull', 'sweat', 'gilet', 't-shirt', 'tee-shirt', 'débardeur', 'body', 'bustier', 'corset', 'polo', 'tunique', 'cardigan', 'maille'].some(c => categorieLower.includes(c))
    const isRobe = ['robe', 'combinaison', 'combi', 'salopette'].some(c => categorieLower.includes(c))
    const isJupe = categorieLower.includes('jupe')
    const isVeste = ['veste', 'manteau', 'blouson', 'blazer', 'parka', 'doudoune', 'trench', 'cape', 'poncho', 'imperméable'].some(c => categorieLower.includes(c))
    const isPantalon = ['pantalon', 'jean', 'jogging', 'legging', 'short'].some(c => categorieLower.includes(c))
    const isChaussure = ['chaussure', 'botte', 'bottine', 'basket', 'escarpin', 'sandale', 'mocassin', 'derby', 'mule', 'ballerine', 'talon'].some(c => categorieLower.includes(c))

    const wantSleeve = isHaut || isRobe || isVeste
    const wantCollar = isHaut || isRobe || isVeste
    const wantLength = isRobe || isJupe
    const wantClosure = isHaut || isRobe || isVeste || isPantalon || isJupe
    const wantShoeType = isChaussure

    // Télécharger l'image et convertir en base64
    const imgResponse = await fetch(imageUrl)
    const imgBuffer = Buffer.from(await imgResponse.arrayBuffer())
    const base64 = imgBuffer.toString('base64')
    
    const contentType = imgResponse.headers.get('content-type') || 'image/png'
    const mediaType = contentType.includes('jpeg') || contentType.includes('jpg') 
      ? 'image/jpeg' 
      : contentType.includes('webp')
        ? 'image/webp'
        : 'image/png'

    let extraFields = ''
    let extraJson = ''
    let fieldNum = optionsModele.length > 0 ? 4 : 3

    if (wantSleeve) {
      extraFields += `\n${fieldNum}. MANCHES - Choisis parmi : ${SLEEVE_LENGTHS.join(', ')}`
      extraJson += '  "sleeveLength": "...",\n'
      fieldNum++
    }
    if (wantCollar) {
      extraFields += `\n${fieldNum}. COL - Choisis parmi : ${COLLAR_TYPES.join(', ')}`
      extraJson += '  "collarType": "...",\n'
      fieldNum++
    }
    if (wantLength) {
      extraFields += `\n${fieldNum}. LONGUEUR - Choisis parmi : ${GARMENT_LENGTHS.join(', ')}`
      extraJson += '  "garmentLength": "...",\n'
      fieldNum++
    }
    if (wantClosure) {
      extraFields += `\n${fieldNum}. FERMETURE - Choisis parmi : ${CLOSURE_TYPES.join(', ')}`
      extraJson += '  "closureType": "...",\n'
      fieldNum++
    }
    if (wantShoeType) {
      extraFields += `\n${fieldNum}. TYPE CHAUSSURE - Choisis parmi : ${SHOE_TYPES.join(', ')}`
      extraJson += '  "shoeType": "...",\n'
      fieldNum++
    }

    const prompt = `Tu es expert en mode vintage et luxe. Analyse cette image de vêtement et réponds en JSON.

PRODUIT :
- Nom : ${nom || 'Non spécifié'}
- Marque : ${marque || 'Non spécifiée'}
- Catégorie : ${categorie || 'Non spécifiée'}
- Matière : ${matiere || 'Non spécifiée'}
- Taille : ${taille || 'Non spécifiée'}
- Origine : ${madeIn || 'Non spécifiée'}

ANALYSE L'IMAGE ET RÉPONDS :

1. COULEUR - Choisis parmi : ${couleurs.join(', ')}

2. MOTIF - Choisis parmi : ${MOTIFS.join(', ')}

${optionsModele.length > 0 ? `3. MODÈLE/COUPE - Choisis parmi : ${optionsModele.join(', ')}` : ''}
${extraFields}

${fieldNum}. DESCRIPTION - Rédige une description produit :
   - Style sobre et élégant, jamais d'emphase excessive
   - Si marque connue (Hermès, Chanel, etc.), ajoute 1-2 phrases d'histoire factuelle
   - Maximum 3-4 phrases
   - Mentionne la coupe, couleur, motif, longueur des manches, type de col naturellement

Réponds UNIQUEMENT avec ce JSON :
{
  "couleur": "...",
  "motif": "...",
${optionsModele.length > 0 ? '  "modele": "...",\n' : ''}${extraJson}  "description": {
    "fr": "...",
    "en": "..."
  }
}`

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64,
              },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    
    // Parser le JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Format invalide' }, { status: 500 })
    }

    const result = JSON.parse(jsonMatch[0])
    
    // Valider les réponses
    const couleur = couleurs.includes(result.couleur) ? result.couleur : null
    const motif = MOTIFS.includes(result.motif) ? result.motif : null
    const modele = optionsModele.includes(result.modele) ? result.modele : null
    const sleeveLength = wantSleeve && SLEEVE_LENGTHS.includes(result.sleeveLength) ? result.sleeveLength : null
    const collarType = wantCollar && COLLAR_TYPES.includes(result.collarType) ? result.collarType : null
    const garmentLength = wantLength && GARMENT_LENGTHS.includes(result.garmentLength) ? result.garmentLength : null
    const closureType = wantClosure && CLOSURE_TYPES.includes(result.closureType) ? result.closureType : null
    const shoeType = wantShoeType && SHOE_TYPES.includes(result.shoeType) ? result.shoeType : null

    return NextResponse.json({ 
      success: true, 
      couleur,
      motif,
      modele,
      sleeveLength,
      collarType,
      garmentLength,
      closureType,
      shoeType,
      descriptions: result.description
    })

  } catch (error: any) {
    console.error('Erreur analyse produit:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}