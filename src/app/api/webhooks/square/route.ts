// src/app/api/webhooks/square/route.ts
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import crypto from 'crypto'
import { Resend } from 'resend'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore'
import { Client, Environment } from 'square'
import { removeFromAllChannels } from '@/lib/syncRemoveFromAllChannels'

// Initialiser Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

const adminDb = getFirestore()
const resend = new Resend(process.env.RESEND_API_KEY)
const webhookSignatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY_SITE

// Initialiser Square Client (réutilisé pour suppression)
const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN!,
  environment: process.env.SQUARE_ENV === 'production' 
    ? Environment.Production 
    : Environment.Sandbox
})

// Générer un numéro de groupe unique pour regrouper les commandes
function genererNumeroGroupe(email: string, date: Date): string {
  const dateStr = date.toISOString().split('T')[0].replace(/-/g, '')
  const emailHash = email.split('@')[0].substring(0, 4).toUpperCase()
  return `GRP-${dateStr}-${emailHash}`
}

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const headersList = await headers()
    
    // Vérifier la signature Square (sécurité)
    const signature = headersList.get('x-square-hmacsha256-signature')
    
    if (webhookSignatureKey && signature) {
      const hash = crypto
        .createHmac('sha256', webhookSignatureKey)
        .update(body)
        .digest('base64')
      
      if (hash !== signature) {
        console.error('❌ Signature webhook invalide')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    const event = JSON.parse(body)
    
    console.log('🔔 Webhook Square reçu:', event.type)

    // On ne traite que les paiements complétés
    if (event.type !== 'payment.updated' && event.type !== 'payment.created') {
      return NextResponse.json({ received: true })
    }

    const payment = event.data?.object?.payment
    
    if (!payment || payment.status !== 'COMPLETED') {
      console.log('⏭️ Paiement non complété, ignoré')
      return NextResponse.json({ received: true })
    }

    const orderId = payment.order_id
    
    if (!orderId) {
      console.log('⚠️ Pas d\'order_id dans le paiement')
      return NextResponse.json({ received: true })
    }

    console.log('✅ Paiement complété pour order:', orderId)

    // Récupérer les metadata depuis Square
    let productId: string | null = null
    let clientInfo: { prenom: string; nom: string; email: string; telephone?: string } | null = null
    let modeLivraison: string | null = null
    let adresse: any = null
    let nombreAchats = 1

    try {
      const { result } = await squareClient.ordersApi.retrieveOrder(orderId)
      const order = result.order
      
      if (order?.metadata) {
        productId = order.metadata.productId
        
        // Extraire nom et prénom
        const nomComplet = order.metadata.clientNom || ''
        const parts = nomComplet.trim().split(' ')
        const prenom = parts[0] || ''
        const nom = parts.slice(1).join(' ') || parts[0] || ''
        
        clientInfo = {
          prenom,
          nom,
          email: order.metadata.clientEmail || '',
          telephone: order.metadata.clientTelephone || undefined
        }
        
        modeLivraison = order.metadata.modeLivraison
        nombreAchats = parseInt(order.metadata.nombreAchats || '1')
        
        // Parser l'adresse si livraison
        if (order.metadata.adresseLivraison) {
          try {
            adresse = JSON.parse(order.metadata.adresseLivraison)
          } catch (e) {
            console.error('Erreur parsing adresse:', e)
          }
        }
        
        console.log('📦 Produit ID:', productId)
        console.log('👤 Client:', clientInfo.email)
        console.log('🛵 Mode:', modeLivraison)
      }
      
      // Récupérer les line items pour avoir le nom du produit
      const lineItems = order?.lineItems || []
      const productName = lineItems[0]?.name || 'Produit'
      const productPrice = lineItems[0]?.basePriceMoney?.amount 
        ? Number(lineItems[0].basePriceMoney.amount) / 100 
        : 0
      
      if (!productId) {
        console.log('⚠️ Pas de productId dans les metadata')
        return NextResponse.json({ received: true })
      }

      if (!clientInfo || !clientInfo.email) {
        console.log('⚠️ Pas d\'infos client')
        return NextResponse.json({ received: true })
      }

      // Récupérer les infos produit depuis Firebase
      const produitRef = adminDb.collection('produits').doc(productId)
      const produitSnap = await produitRef.get()

      if (!produitSnap.exists) {
        console.error('❌ Produit non trouvé:', productId)
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }

      const produitData = produitSnap.data()!
      const quantiteActuelle = produitData.quantite || 1

      // 1. Mettre à jour le produit dans Firebase
      const nouvelleQuantite = Math.max(0, quantiteActuelle - 1)
      
      // Vérifier si la chineuse est en petite série
      const tri = (produitData.sku || '').match(/^[A-Za-z]+/)?.[0]?.toUpperCase()
      let isSmallBatch = false
      if (tri && nouvelleQuantite === 0) {
        const chineuseSnap = await adminDb.collection('chineuse')
          .where('trigramme', '==', tri)
          .limit(1)
          .get()
        if (!chineuseSnap.empty) {
          isSmallBatch = chineuseSnap.docs[0].data().stockType === 'smallBatch'
        }
      }

      const updateData: any = {
        quantite: nouvelleQuantite
      }

      if (nouvelleQuantite === 0) {
        if (isSmallBatch) {
          updateData.statut = 'outOfStock'
          updateData.dateRupture = Timestamp.now()
          updateData.squareOrderId = orderId
        } else {
          updateData.vendu = true
          updateData.dateVente = Timestamp.now()
          updateData.squareOrderId = orderId
        }
      }

      await produitRef.update(updateData)
      console.log('✅ Produit mis à jour:', productId, '- Nouvelle quantité:', nouvelleQuantite)

      // 🆕 Si quantité = 0 ET pièce unique, supprimer de Square
      if (nouvelleQuantite === 0 && !isSmallBatch && (produitData.catalogObjectId || produitData.variationId || produitData.itemId)) {
        try {
          console.log('🗑️ Suppression du produit dans Square...')
          
          const variationId = produitData.variationId || produitData.catalogObjectId
          
          if (variationId) {
            try {
              await squareClient.catalogApi.deleteCatalogObject(variationId)
              console.log('✅ Variation supprimée de Square:', variationId)
            } catch (delError: any) {
              console.warn('⚠️ Suppression variation échouée:', delError?.message)
            }
          }
          
          const itemId = produitData.itemId
          if (itemId) {
            try {
              await squareClient.catalogApi.deleteCatalogObject(itemId)
              console.log('✅ Item supprimé de Square:', itemId)
            } catch (delItemError: any) {
              console.warn('⚠️ Suppression item échouée, tentative d\'archivage...', delItemError?.message)
              
              try {
                const { result } = await squareClient.catalogApi.retrieveCatalogObject(itemId)
                const item = result.object
                
                if (item && item.itemData) {
                  await squareClient.catalogApi.upsertCatalogObject({
                    idempotencyKey: `archive-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                    object: {
                      id: itemId,
                      type: 'ITEM',
                      version: item.version,
                      presentAtAllLocations: false,
                      itemData: {
                        name: item.itemData.name || 'Archived',
                        description: item.itemData.description,
                        categoryId: item.itemData.categoryId,
                        variations: item.itemData.variations,
                        productType: item.itemData.productType,
                        isArchived: true,
                      }
                    }
                  })
                  console.log('✅ Produit archivé dans Square:', itemId)
                }
              } catch (archiveError: any) {
                console.error('❌ Archivage Square échoué:', archiveError?.message)
              }
            }
          }
          
        } catch (squareError: any) {
          console.error('❌ Erreur globale suppression Square:', squareError?.message)
        }
      }

      // 🇺🇸 Retirer d'eBay si quantité = 0 (pièce unique OU petite série)
      if (nouvelleQuantite === 0 && (produitData.ebayListingId || produitData.ebayOfferId)) {
        try {
          console.log('🇺🇸 Retrait du produit d\'eBay...')
          await removeFromAllChannels(
            {
              id: productId,
              sku: produitData.sku,
              ebayOfferId: produitData.ebayOfferId,
              ebayListingId: produitData.ebayListingId,
            },
            'site'
          )
          console.log('✅ Produit retiré d\'eBay')
        } catch (ebayError: any) {
          console.error('⚠️ Erreur retrait eBay (non bloquant):', ebayError?.message)
        }
      }

      // 2. Créer la commande dans Firebase
      const now = new Date()
      const numeroGroupe = genererNumeroGroupe(clientInfo.email, now)
      
      const debutJournee = new Date(now)
      debutJournee.setHours(0, 0, 0, 0)
      const finJournee = new Date(now)
      finJournee.setHours(16, 0, 0, 0)
      
      const commandesExistantes = await adminDb
        .collection('commandes')
        .where('client.email', '==', clientInfo.email)
        .where('dateCommande', '>=', Timestamp.fromDate(debutJournee))
        .where('dateCommande', '<=', Timestamp.fromDate(finJournee))
        .where('statut', 'in', ['en_attente', 'preparee'])
        .get()

      const autresCommandesIds = commandesExistantes.docs.map(doc => doc.id)
      
      const nouvelleCommande = {
        orderId,
        productId,
        productName: produitData.nom || productName,
        productSku: produitData.sku || null,
        productMarque: produitData.marque || null,
        productImage: produitData.images?.[0] || produitData.imageUrl || produitData.photos?.face || null,
        prix: produitData.prix || productPrice,
        
        client: clientInfo,
        modeLivraison,
        adresse: modeLivraison === 'livraison' ? adresse : null,
        
        statut: 'en_attente',
        
        dateCommande: Timestamp.fromDate(now),
        datePaiement: Timestamp.fromDate(now),
        
        numeroGroupe,
        regroupeAvec: autresCommandesIds,
        nombreAchatsClient: nombreAchats,
        
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      }

      const commandeRef = await adminDb.collection('commandes').add(nouvelleCommande)
      const commandeId = commandeRef.id
      
      console.log('✅ Commande créée:', commandeId)

      // 3. Mettre à jour les autres commandes du groupe
      if (autresCommandesIds.length > 0) {
        const batch = adminDb.batch()
        
        for (const autreCommandeId of autresCommandesIds) {
          const autreRef = adminDb.collection('commandes').doc(autreCommandeId)
          batch.update(autreRef, {
            regroupeAvec: FieldValue.arrayUnion(commandeId),
            updatedAt: Timestamp.now()
          })
        }
        
        await batch.commit()
        console.log('✅ Commandes du groupe mises à jour')
      }

      // 4. Envoyer l'email de notification
      const estGroupe = autresCommandesIds.length > 0
      const totalCommandes = autresCommandesIds.length + 1
      
      const emailData = await resend.emails.send({
        from: 'Nouvelle Rive <onboarding@resend.dev>',
        to: 'nouvelleriveparis@gmail.com',
        subject: estGroupe 
          ? `🎉 Vente en ligne #${totalCommandes} - ${clientInfo.prenom} ${clientInfo.nom}` 
          : `🎉 Nouvelle vente en ligne - ${produitData.nom}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #22209C;">🎉 ${estGroupe ? `Nouvelle vente groupée (${totalCommandes} produits)` : 'Nouvelle vente en ligne'} !</h1>
            
            ${estGroupe ? `
              <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <p style="margin: 0; font-weight: bold; color: #856404;">
                  ⚠️ ATTENTION : Ce client a déjà commandé ${autresCommandesIds.length} produit(s) aujourd'hui !
                </p>
                <p style="margin: 5px 0 0 0; color: #856404;">
                  Groupe de commande : <strong>${numeroGroupe}</strong>
                </p>
              </div>
            ` : ''}
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin-top: 0;">Produit vendu</h2>
              <p><strong>Nom :</strong> ${produitData.nom}</p>
              ${produitData.sku ? `<p><strong>SKU :</strong> ${produitData.sku}</p>` : ''}
              ${produitData.marque ? `<p><strong>Marque :</strong> ${produitData.marque}</p>` : ''}
              <p><strong>Prix :</strong> ${produitData.prix?.toFixed(2) || '0.00'} €</p>
              <p><strong>Quantité restante :</strong> ${nouvelleQuantite}</p>
              ${nouvelleQuantite === 0 ? '<p style="color: #d32f2f; font-weight: bold;">🗑️ Produit retiré automatiquement</p>' : ''}
            </div>

            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2 style="margin-top: 0;">Informations client</h2>
              <p><strong>Nom :</strong> ${clientInfo.prenom} ${clientInfo.nom}</p>
              <p><strong>Email :</strong> ${clientInfo.email}</p>
              ${clientInfo.telephone ? `<p><strong>Téléphone :</strong> ${clientInfo.telephone}</p>` : ''}
              <p><strong>Mode :</strong> ${modeLivraison === 'livraison' ? '📦 Livraison' : '🏪 Retrait en boutique'}</p>
              ${adresse ? `
                <div style="margin-top: 10px; padding: 10px; background: white; border-radius: 4px;">
                  <p style="margin: 0;"><strong>Adresse de livraison :</strong></p>
                  <p style="margin: 5px 0 0 0;">
                    ${adresse.rue}<br>
                    ${adresse.complementAdresse ? adresse.complementAdresse + '<br>' : ''}
                    ${adresse.codePostal} ${adresse.ville}<br>
                    ${adresse.pays}
                  </p>
                </div>
              ` : ''}
            </div>

            <div style="background: #ffebee; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f44336;">
              <h3 style="margin-top: 0; color: #c62828;">🚨 ACTION IMMÉDIATE REQUISE</h3>
              <p style="font-size: 16px; font-weight: bold; color: #c62828;">
                1. RETIRER LE PRODUIT DE LA SURFACE DE VENTE MAINTENANT
              </p>
              <p style="font-size: 16px; font-weight: bold; color: #c62828;">
                2. ${modeLivraison === 'livraison' ? 'PRÉPARER L\'EXPÉDITION' : 'PRÉPARER LE RETRAIT'}
              </p>
              ${nouvelleQuantite === 0 ? '<p style="color: #d32f2f; font-weight: bold;">⚠️ PLUS DE STOCK DISPONIBLE !</p>' : ''}
              ${estGroupe ? '<p style="color: #f57c00; font-weight: bold;">📦 À REGROUPER AVEC LES AUTRES COMMANDES DU CLIENT</p>' : ''}
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXT_PUBLIC_BASE_URL}/admin/commandes" 
                 style="background: #22209C; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                📋 Voir toutes les commandes
              </a>
            </div>

            <p style="color: #666; font-size: 12px; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px;">
              Commande ID : ${commandeId}<br>
              Commande Square : ${orderId}<br>
              ${now.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}
            </p>
          </div>
        `
      })

      console.log('✅ Email envoyé:', emailData.data?.id)

    } catch (error) {
      console.error('❌ Erreur traitement webhook:', error)
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('❌ Erreur webhook:', error)
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 })
  }
}