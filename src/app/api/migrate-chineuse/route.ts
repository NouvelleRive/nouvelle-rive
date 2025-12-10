// app/api/migrate-chineuse/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminAuth } from '@/lib/firebaseAdmin'

export async function POST(req: NextRequest) {
  try {
    // Vérifier que c'est un admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Non autorisé' }, { status: 401 })
    }
    
    const token = authHeader.split('Bearer ')[1]
    
    // Vérifier le token et si c'est un admin
    let decodedToken
    try {
      decodedToken = await adminAuth.verifyIdToken(token)
    } catch (e) {
      return NextResponse.json({ success: false, error: 'Token invalide' }, { status: 401 })
    }

    // Vérifier si admin (email dans liste)
    const adminEmails = ['nimusic92@gmail.com', 'nouvelleriveparis@gmail.com']
    if (!adminEmails.includes(decodedToken.email || '') && !decodedToken.admin) {
      return NextResponse.json({ success: false, error: 'Accès admin requis' }, { status: 403 })
    }

    // Récupérer toutes les chineuses
    const snapshot = await adminDb.collection('chineuse').get()
    
    const results = {
      migrated: 0,
      alreadyOk: 0,
      doublonsSupprimes: 0,
      errors: [] as string[]
    }

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data()
        const docId = doc.id
        
        // Vérifier si c'est un doublon (document créé par uid sans données utiles)
        // Ces documents n'ont généralement pas de trigramme ni de nom
        if (!data.trigramme && !data.nom && !data.email) {
          // C'est probablement un doublon vide, on le supprime
          await adminDb.collection('chineuse').doc(docId).delete()
          results.doublonsSupprimes++
          continue
        }

        // Récupérer les infos depuis Catégorie de rapport[0]
        const catRapport = (data['Catégorie de rapport'] || [])[0] || {}
        
        // Vérifier si migration nécessaire (infos dans catRapport mais pas à la racine)
        const needsMigration = (
          (catRapport.siret && !data.siret) ||
          (catRapport.iban && !data.iban) ||
          (catRapport.taux && !data.taux)
        )

        if (!needsMigration && data.siret) {
          // Déjà migré
          results.alreadyOk++
          continue
        }

        // Préparer les données à migrer
        const updateData: Record<string, any> = {}
        
        // Copier les infos comptables à la racine
        if (catRapport.siret) updateData.siret = catRapport.siret
        if (catRapport.iban) updateData.iban = catRapport.iban
        if (catRapport.bic) updateData.bic = catRapport.bic
        if (catRapport.tva) updateData.tva = catRapport.tva
        if (catRapport.adresse1) updateData.adresse1 = catRapport.adresse1
        if (catRapport.adresse2) updateData.adresse2 = catRapport.adresse2
        if (catRapport.banqueAdresse) updateData.banqueAdresse = catRapport.banqueAdresse
        if (catRapport.taux) updateData.taux = catRapport.taux

        // Nettoyer Catégorie de rapport (garder juste label + idsquare)
        if (data['Catégorie de rapport'] && data['Catégorie de rapport'].length > 0) {
          updateData['Catégorie de rapport'] = data['Catégorie de rapport'].map((cat: any) => ({
            label: cat.label || '',
            idsquare: cat.idsquare || ''
          }))
        }

        // Appliquer la migration si des données à mettre à jour
        if (Object.keys(updateData).length > 0) {
          await adminDb.collection('chineuse').doc(docId).update(updateData)
          results.migrated++
        } else {
          results.alreadyOk++
        }

      } catch (err: any) {
        results.errors.push(`${doc.id}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migration terminée: ${results.migrated} migrées, ${results.alreadyOk} déjà OK, ${results.doublonsSupprimes} doublons supprimés`,
      results
    })

  } catch (err: any) {
    console.error('Erreur migration:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}