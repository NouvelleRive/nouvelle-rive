// app/api/analyze-product/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { MODELES } from '@/lib/modeles'
import { MOTIFS } from '@/lib/motifs'
import { COLOR_PALETTE } from '@/lib/couleurs'

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

4. DESCRIPTION - Rédige une description produit :
   - Style sobre et élégant, jamais d'emphase excessive
   - Si marque connue (Hermès, Chanel, etc.), ajoute 1-2 phrases d'histoire factuelle
   - Maximum 3-4 phrases
   - Mentionne la coupe, couleur, motif naturellement

Réponds UNIQUEMENT avec ce JSON :
{
  "couleur": "...",
  "motif": "...",
  ${optionsModele.length > 0 ? '"modele": "...",' : ''}
  "description": {
    "fr": "...",
    "en": "..."
  }
}`

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 800,
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

    return NextResponse.json({ 
      success: true, 
      couleur,
      motif,
      modele,
      descriptions: result.description
    })

  } catch (error: any) {
    console.error('Erreur analyse produit:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}