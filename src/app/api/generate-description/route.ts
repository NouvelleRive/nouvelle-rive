// app/api/generate-description/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { nom, marque, categorie, matiere, couleur, taille, madeIn } = await req.json()

    if (!nom) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
    }

    const prompt = `Tu es expert en mode vintage et luxe de seconde main. Génère une description produit pour une boutique parisienne chic.

PRODUIT :
- Nom : ${nom}
- Marque : ${marque || 'Non spécifiée'}
- Catégorie : ${categorie || 'Non spécifiée'}
- Matière : ${matiere || 'Non spécifiée'}
- Couleur : ${couleur || 'Non spécifiée'}
- Taille : ${taille || 'Non spécifiée'}
- Origine : ${madeIn || 'Non spécifiée'}

CONSIGNES :
- Style sobre et élégant, jamais d'emphase excessive (pas de "magnifique", "exceptionnel", "incroyable")
- Si c'est une marque connue (Hermès, Chanel, Dior, Vuitton, etc.), ajoute 1-2 phrases d'histoire factuelle (date de création du modèle, anecdote vérifiable)
- Maximum 3-4 phrases en français
- Mentionne les détails pratiques (matière, couleur, taille) naturellement
- Corrige toute faute d'orthographe dans les infos fournies

Réponds UNIQUEMENT avec ce format JSON :
{
  "fr": "Description en français",
  "en": "Description in English"
}`

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    
    // Parser le JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Format invalide' }, { status: 500 })
    }
    
    const descriptions = JSON.parse(jsonMatch[0])

    return NextResponse.json({ success: true, descriptions })
  } catch (error: any) {
    console.error('Erreur génération:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}