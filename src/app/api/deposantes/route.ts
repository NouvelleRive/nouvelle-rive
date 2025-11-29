// app/api/deposantes/route.ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebaseAdmin'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const ADMIN_EMAIL = 'nouvelleriveparis@gmail.com'

function generateSlug(nom: string): string {
  return nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Fonction pour créer le compte Auth (sans envoyer d'email)
async function ensureAuthAccount(email: string, nom: string): Promise<{ uid: string; created: boolean }> {
  if (!email?.trim()) {
    return { uid: '', created: false }
  }

  const cleanEmail = email.trim().toLowerCase()

  try {
    // Vérifier si le compte existe déjà
    const existingUser = await adminAuth.getUserByEmail(cleanEmail)
    return { uid: existingUser.uid, created: false }
  } catch (error: any) {
    // Si l'utilisateur n'existe pas, on le crée
    if (error.code === 'auth/user-not-found') {
      try {
        // Générer un mot de passe temporaire (vous pourrez le changer dans la console Firebase)
        const tempPassword = `NR_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
        
        const newUser = await adminAuth.createUser({
          email: cleanEmail,
          displayName: nom?.trim() || '',
          password: tempPassword,
          emailVerified: false,
        })

        console.log(`✅ Compte Auth créé pour ${cleanEmail} (uid: ${newUser.uid})`)

        return { uid: newUser.uid, created: true }
      } catch (createError: any) {
        console.error(`❌ Erreur création compte Auth pour ${cleanEmail}:`, createError.message)
        throw createError
      }
    }
    throw error
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      id,
      nom,
      trigramme,
      email,
      instagram,
      accroche,
      description,
      specialite,
      lien,
      imageUrl,
      ordre,
      categories,
      categorieRapport,
    } = body

    if (!nom?.trim()) {
      return NextResponse.json({ success: false, error: 'Nom obligatoire' }, { status: 400 })
    }
    if (!trigramme?.trim()) {
      return NextResponse.json({ success: false, error: 'Trigramme obligatoire' }, { status: 400 })
    }

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ success: false, error: 'Non authentifiée' }, { status: 401 })
    }

    let decoded
    try {
      decoded = await adminAuth.verifyIdToken(token)
    } catch {
      return NextResponse.json({ success: false, error: 'Token invalide' }, { status: 401 })
    }

    if (decoded.email !== ADMIN_EMAIL) {
      return NextResponse.json({ success: false, error: 'Accès réservé admin' }, { status: 403 })
    }

    // Créer le compte Auth si email fourni (sans envoyer d'email)
    let authUid = ''
    let authCreated = false
    if (email?.trim()) {
      try {
        const authResult = await ensureAuthAccount(email, nom)
        authUid = authResult.uid
        authCreated = authResult.created
      } catch (authError: any) {
        console.error('⚠️ Erreur Auth (non bloquante):', authError.message)
        // On continue même si la création Auth échoue
      }
    }

    const adminDb = getFirestore()
    const slug = id || generateSlug(nom.trim())

    // On envoie TOUS les champs, même vides
    const docData: Record<string, any> = {
      nom: nom?.trim() || '',
      trigramme: trigramme?.trim().toUpperCase() || '',
      email: email?.trim() || '',
      instagram: instagram?.trim() || '',
      accroche: accroche?.trim() || '',
      description: description?.trim() || '',
      specialite: specialite?.trim() || '',
      lien: lien?.trim() || '',
      imageUrl: imageUrl?.trim() || '',
      ordre: typeof ordre === 'number' ? ordre : 0,
      displayOnWebsite: true,
      slug,
    }

    // Ajouter l'UID Auth si on l'a
    if (authUid) {
      docData.authUid = authUid
    }

    // Catégories avec idsquare - toujours envoyer le tableau
    if (Array.isArray(categories)) {
      docData['Catégorie'] = categories
        .filter((c: any) => c?.label?.trim())
        .map((c: any) => ({
          label: c.label.trim(),
          idsquare: c.idsquare?.trim() || '',
        }))
    } else {
      docData['Catégorie'] = []
    }

    // Catégorie de rapport avec infos comptables
    if (categorieRapport?.label) {
      docData['Catégorie de rapport'] = [{
        label: categorieRapport.label?.trim() || '',
        idsquare: categorieRapport.idsquare?.trim() || '',
        nom: categorieRapport.nom?.trim() || nom?.trim() || '',
        email: categorieRapport.emailCompta?.trim() || email?.trim() || '',
        trigramme: trigramme?.trim().toUpperCase() || '',
        siret: categorieRapport.siret?.trim() || '',
        tva: categorieRapport.tva?.trim() || '',
        iban: categorieRapport.iban?.trim() || '',
        bic: categorieRapport.bic?.trim() || '',
        banqueAdresse: categorieRapport.banqueAdresse?.trim() || '',
        adresse1: categorieRapport.adresse1?.trim() || '',
        adresse2: categorieRapport.adresse2?.trim() || '',
      }]
    } else {
      docData['Catégorie de rapport'] = []
    }

    const ref = adminDb.collection('chineuse').doc(slug)
    const existing = await ref.get()

    if (existing.exists) {
      docData.updatedAt = FieldValue.serverTimestamp()
      await ref.set(docData, { merge: true })  // merge: true pour ne pas écraser les champs non envoyés
      return NextResponse.json({ 
        success: true, 
        action: 'updated', 
        id: slug,
        authCreated,
        authUid: authUid || undefined
      })
    } else {
      docData.createdAt = FieldValue.serverTimestamp()
      await ref.set(docData)
      return NextResponse.json({ 
        success: true, 
        action: 'created', 
        id: slug,
        authCreated,
        authUid: authUid || undefined
      })
    }

  } catch (e: any) {
    console.error('❌ [API DEPOSANTES]', e?.message || e)
    return NextResponse.json({ success: false, error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID manquant' }, { status: 400 })
    }

    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ success: false, error: 'Non authentifiée' }, { status: 401 })
    }

    let decoded
    try {
      decoded = await adminAuth.verifyIdToken(token)
    } catch {
      return NextResponse.json({ success: false, error: 'Token invalide' }, { status: 401 })
    }

    if (decoded.email !== ADMIN_EMAIL) {
      return NextResponse.json({ success: false, error: 'Accès réservé admin' }, { status: 403 })
    }

    const adminDb = getFirestore()
    
    // Récupérer le doc pour avoir l'email et supprimer aussi le compte Auth
    const docRef = adminDb.collection('chineuse').doc(id)
    const doc = await docRef.get()
    
    if (doc.exists) {
      const data = doc.data()
      const email = data?.email
      
      // Supprimer le compte Auth si il existe
      if (email) {
        try {
          const user = await adminAuth.getUserByEmail(email)
          await adminAuth.deleteUser(user.uid)
          console.log(`✅ Compte Auth supprimé pour ${email}`)
        } catch (authError: any) {
          // Pas grave si le compte Auth n'existe pas
          if (authError.code !== 'auth/user-not-found') {
            console.error('⚠️ Erreur suppression Auth:', authError.message)
          }
        }
      }
    }
    
    await docRef.delete()

    return NextResponse.json({ success: true, action: 'deleted', id })

  } catch (e: any) {
    console.error('❌ [API DEPOSANTES DELETE]', e?.message || e)
    return NextResponse.json({ success: false, error: e?.message || 'Erreur serveur' }, { status: 500 })
  }
}