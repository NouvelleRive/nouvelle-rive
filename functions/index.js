const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { Client, Environment } = require("square");
const { v4: uuidv4 } = require("uuid");

admin.initializeApp();
const db = admin.firestore();

const squareClient = new Client({
  accessToken: "EAAAl47KiVln6ChvRD8zUXqLU4LWjc4-7VSJfUEsBOm5QE4IBUiR_ChKoi3OBJm9",
  environment: Environment.Production,
});

const locationId = "L9SXWZQHWAJF4";

exports.onProductReceived = functions
  .region("europe-west1")
  .firestore
  .document("produits/{productId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const productId = context.params.productId;

    // CAS 1: Produit reçu en boutique → créer dans Square
    if (before.recu === false && after.recu === true) {
      console.log(`📦 Produit reçu: ${productId} (${after.sku})`);

      if (!after.sku) {
        console.log(`⚠️ Pas de SKU pour ${productId}, skip Square`);
        return null;
      }

      const idempotencyKey = uuidv4();
      const itemId = `#item_${after.sku}`;
      const variationId = `#variation_${after.sku}`;

      const itemData = {
        type: 'ITEM',
        id: itemId,
        itemData: {
          name: after.nom,
          description: after.description || '',
          categoryId: typeof after.categorie === 'object' ? after.categorie?.idsquare : undefined,
          reportingCategory: (typeof after.categorie === 'object' && after.categorie?.reportingCategoryId) ? { id: after.categorie.reportingCategoryId } : undefined,
          variations: [
            {
              type: 'ITEM_VARIATION',
              id: variationId,
              itemVariationData: {
                itemId: itemId,
                name: after.nom,
                sku: after.sku,
                pricingType: 'FIXED_PRICING',
                priceMoney: {
                  amount: Math.round((after.prix || 0) * 100),
                  currency: 'EUR',
                },
                trackInventory: true,
                locationOverrides: [
                  {
                    locationId,
                    trackInventory: true,
                  },
                ],
              },
            },
          ],
        },
      };

      const createdItems = new Map();

      try {
        const { result } = await squareClient.catalogApi.batchUpsertCatalogObjects({
          idempotencyKey,
          batches: [{ objects: [itemData] }],
        });

        if (result.idMappings) {
          for (const mapping of result.idMappings) {
            const clientId = mapping.clientObjectId || '';
            const realId = mapping.objectId || '';
            
            if (clientId.startsWith('#item_')) {
              const sku = clientId.replace('#item_', '');
              if (!createdItems.has(sku)) {
                createdItems.set(sku, { itemId: realId, variationId: '' });
              } else {
                createdItems.get(sku).itemId = realId;
              }
            } else if (clientId.startsWith('#variation_')) {
              const sku = clientId.replace('#variation_', '');
              if (!createdItems.has(sku)) {
                createdItems.set(sku, { itemId: '', variationId: realId });
              } else {
                createdItems.get(sku).variationId = realId;
              }
            }
          }
        }

        const ids = createdItems.get(after.sku);
        console.log(`✅ Créé dans Square: ${after.sku} → item=${ids?.itemId}, variation=${ids?.variationId}`);

        if (ids?.variationId) {
          await squareClient.inventoryApi.batchChangeInventory({
            idempotencyKey: uuidv4(),
            changes: [
              {
                type: 'PHYSICAL_COUNT',
                physicalCount: {
                  catalogObjectId: ids.variationId,
                  locationId,
                  quantity: String(after.quantite || 1),
                  state: 'IN_STOCK',
                  occurredAt: new Date().toISOString(),
                },
              },
            ],
          });
          console.log(`✅ Stock mis à jour: ${after.quantite || 1}`);
        }

        if (ids) {
          await change.after.ref.update({
            catalogObjectId: ids.itemId,
            variationId: ids.variationId,
            itemId: ids.itemId,
            squareSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // Upload image vers Square
          const imageUrl = after.photos?.face || after.imageUrl || (after.imageUrls && after.imageUrls[0])
          if (imageUrl && ids.itemId) {
            try {
              const fetch = require('node-fetch')
              const FormData = require('form-data')
              
              const imageResponse = await fetch(imageUrl)
              const imageBuffer = await imageResponse.buffer()
              
              const formData = new FormData()
              formData.append('file', imageBuffer, {
                filename: 'product.jpg',
                contentType: 'image/jpeg',
              })
              
              const metadata = {
                idempotency_key: uuidv4(),
                object_id: ids.itemId,
                image: {
                  type: 'IMAGE',
                  id: `#image-${Date.now()}`,
                  image_data: {
                    caption: after.nom,
                  },
                },
              }
              formData.append('request', JSON.stringify(metadata), {
                contentType: 'application/json',
              })
              
              const uploadResponse = await fetch('https://connect.squareup.com/v2/catalog/images', {
                method: 'POST',
                headers: {
                  'Authorization': 'Bearer EAAAl47KiVln6ChvRD8zUXqLU4LWjc4-7VSJfUEsBOm5QE4IBUiR_ChKoi3OBJm9',
                  'Square-Version': '2023-09-25',
                  ...formData.getHeaders(),
                },
                body: formData,
              })
              
              if (uploadResponse.ok) {
                console.log(`📷 Image uploadée pour ${after.sku}`)
              } else {
                console.warn(`⚠️ Image non uploadée pour ${after.sku}`)
              }
            } catch (imgErr) {
              console.warn(`⚠️ Erreur upload image ${after.sku}:`, imgErr.message)
            }
          }
        }

      } catch (squareError) {
        console.error(`❌ Square batch upsert error:`, squareError?.message || squareError);
        if (squareError?.errors) {
          console.error(`❌ Square errors:`, JSON.stringify(squareError.errors));
        }
        if (squareError?.body) {
          console.error(`❌ Square body:`, squareError.body);
        }
        if (squareError?.result) {
          console.error(`❌ Square result:`, JSON.stringify(squareError.result));
        }
      }
    }

    // CAS 2: Produit modifié (prix, nom, quantité) → mettre à jour Square
    if (after.variationId) {
      const prixChange = before.prix !== after.prix;
      const nomChange = before.nom !== after.nom;
      const descChange = before.description !== after.description;
      const qteChange = before.quantite !== after.quantite;

      if (prixChange || nomChange || descChange || qteChange) {
        console.log(`✏️ Produit modifié: ${productId} (${after.sku})`);

        try {
          // Récupérer l'objet actuel pour avoir la version
          const { result: retrieveResult } = await squareClient.catalogApi.retrieveCatalogObject(after.variationId);
          const currentVersion = retrieveResult.object?.version;

          if (prixChange || nomChange || descChange) {
            // Mettre à jour l'item et la variation
            const { result: itemResult } = await squareClient.catalogApi.retrieveCatalogObject(after.itemId || after.catalogObjectId);
            const itemVersion = itemResult.object?.version;

            await squareClient.catalogApi.batchUpsertCatalogObjects({
              idempotencyKey: uuidv4(),
              batches: [{
                objects: [
                  {
                    type: 'ITEM',
                    id: after.itemId || after.catalogObjectId,
                    version: itemVersion,
                    itemData: {
                      name: after.nom,
                      description: after.description || '',
                      variations: [
                        {
                          type: 'ITEM_VARIATION',
                          id: after.variationId,
                          version: currentVersion,
                          itemVariationData: {
                            itemId: after.itemId || after.catalogObjectId,
                            name: after.nom,
                            sku: after.sku,
                            pricingType: 'FIXED_PRICING',
                            priceMoney: {
                              amount: Math.round((after.prix || 0) * 100),
                              currency: 'EUR',
                            },
                          },
                        },
                      ],
                    },
                  },
                ],
              }],
            });
            console.log(`✅ Mis à jour dans Square: ${after.sku} (prix/nom/desc)`);
          }

          if (qteChange) {
            await squareClient.inventoryApi.batchChangeInventory({
              idempotencyKey: uuidv4(),
              changes: [
                {
                  type: 'PHYSICAL_COUNT',
                  physicalCount: {
                    catalogObjectId: after.variationId,
                    locationId,
                    quantity: String(after.quantite || 1),
                    state: 'IN_STOCK',
                    occurredAt: new Date().toISOString(),
                  },
                },
              ],
            });
            console.log(`✅ Stock mis à jour dans Square: ${after.quantite || 1}`);
          }

        } catch (squareError) {
          console.error(`❌ Square update error:`, squareError?.message || squareError);
          if (squareError?.body) {
            console.error(`❌ Square body:`, squareError.body);
          }
        }
      }

      // CAS 2b: Sync eBay si le produit est publié sur eBay
      if (after.ebayListingId) {
        const prixChange = before.prix !== after.prix
        const nomChange = before.nom !== after.nom
        const descChange = before.description !== after.description
        const imageChange = JSON.stringify(before.imageUrls || []) !== JSON.stringify(after.imageUrls || [])
        const photoChange = JSON.stringify(before.photos || {}) !== JSON.stringify(after.photos || {})
        const aspectsChange = before.marque !== after.marque || before.taille !== after.taille || before.material !== after.material || before.color !== after.color || before.bagSizeName !== after.bagSizeName || before.madeIn !== after.madeIn || before.modele !== after.modele

        if (prixChange || nomChange || descChange || imageChange || photoChange || aspectsChange) {
          try {
            const siteUrl = 'https://nouvellerive.eu'
            const fetch = require('node-fetch')
            const response = await fetch(`${siteUrl}/api/sync/product`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-secret': process.env.API_SECRET || 'NR_INTERNAL_SYNC_2026'
              },
              body: JSON.stringify({ productId: productId }),
            })
            const result = await response.json()
            if (result.success) {
              console.log(`✅ eBay mis à jour: ${after.sku}`)
            } else {
              console.warn(`⚠️ eBay update failed: ${result.error}`)
            }
          } catch (ebayErr) {
            console.warn(`⚠️ Erreur sync eBay: ${ebayErr.message}`)
          }
        }
      }
    }

    // CAS 3b: Produit passe en outOfStock (petite série) → stock Square à 0 mais garder le produit
    if (after.statut === 'outOfStock' && before.statut !== 'outOfStock') {
      console.log(`📦 Produit en rupture (petite série): ${productId} (${after.sku})`);
      if (after.variationId) {
        try {
          await squareClient.inventoryApi.batchChangeInventory({
            idempotencyKey: uuidv4(),
            changes: [{
              type: 'PHYSICAL_COUNT',
              physicalCount: {
                catalogObjectId: after.variationId,
                locationId,
                quantity: '0',
                state: 'IN_STOCK',
                occurredAt: new Date().toISOString(),
              },
            }],
          });
          console.log(`✅ Stock Square mis à 0 (produit conservé): ${after.sku}`);
        } catch (err) {
          console.error(`❌ Erreur stock Square:`, err?.message);
        }
      }
    }

    // CAS 3: Produit passe en retour → supprimer de Square
    if (before.statut !== "retour" && after.statut === "retour") {
      console.log(`📤 Produit retourné: ${productId} (${after.sku})`);

      const squareIds = [];
      if (after.variationId) squareIds.push(String(after.variationId));
      if (after.catalogObjectId) squareIds.push(String(after.catalogObjectId));
      if (after.itemId) squareIds.push(String(after.itemId));

      if (squareIds.length > 0) {
        try {
          await squareClient.catalogApi.batchDeleteCatalogObjects({ objectIds: squareIds });
          console.log(`✅ Supprimé de Square: ${after.sku}`);
        } catch (squareError) {
          console.error(`❌ Erreur suppression Square:`, squareError);
        }
      }
    }

    return null;
  });

exports.onProductDeleted = functions
  .region("europe-west1")
  .firestore
  .document("produits/{productId}")
  .onDelete(async (snap, context) => {
    const data = snap.data();
    const productId = context.params.productId;

    console.log(`🗑️ Produit supprimé: ${productId} (${data.sku})`);

    const squareIds = [];
    if (data.variationId) squareIds.push(String(data.variationId));
    if (data.catalogObjectId) squareIds.push(String(data.catalogObjectId));
    if (data.itemId) squareIds.push(String(data.itemId));

    if (squareIds.length > 0) {
      try {
        await squareClient.catalogApi.batchDeleteCatalogObjects({ objectIds: squareIds });
        console.log(`✅ Supprimé de Square: ${data.sku}`);
      } catch (squareError) {
        console.error(`❌ Erreur suppression Square:`, squareError);
      }
    }

    return null;
  });
  exports.checkGmailFactures = functions
  .region("europe-west1")
  .pubsub.schedule("every day 09:00")
  .timeZone("Europe/Paris")
  .onRun(async (context) => {
    const fetch = require('node-fetch')

    // Obtenir un access token Gmail
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    })
    const { access_token } = await tokenRes.json()

    // Récupérer tous les statuts paiements du mois en cours
    const now = new Date()
    const mois = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`

    // Récupérer toutes les chineuses
    const chineusesSnap = await db.collection('chineuse').get()
    const chineuses = chineusesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    const m = String(now.getMonth() + 1).padStart(2, '0')
    for (const ch of chineuses) {
  if (!ch.email || !ch.trigramme) continue
  const trigramme = ch.trigramme.toUpperCase()

  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const searchY = lastMonth.getFullYear()
  const searchM = String(lastMonth.getMonth() + 1).padStart(2, '0')
  const allEmails = [ch.email, ...(ch.emails || [])].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)
const fromClause = allEmails.map(e => `from:${e}`).join(' OR ')
const query = encodeURIComponent(`(${fromClause}) (has:attachment OR has:drive) after:${searchY}/${searchM}/01`)

  const gmailRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=20`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  )
  const gmailData = await gmailRes.json()
  if (gmailData.error) { console.error(`❌ Gmail error ${ch.email}:`, JSON.stringify(gmailData.error)); continue }
  if (!gmailData.messages) { console.log(`📭 Aucun mail avec PJ: ${ch.email}`); continue }

  console.log(`📬 ${gmailData.messages.length} mail(s) de ${ch.email}`)

  for (const msg of gmailData.messages) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    )
    const msgData = await msgRes.json()

    const getAllParts = (payload) => {
      if (!payload) return []
      const parts = payload.parts || []
      return [...parts, ...parts.flatMap(p => getAllParts(p))]
    }

    // Candidats où la ref peut apparaître : nom de PJ, sujet, snippet, corps complet (cas Drive sans PJ)
    const candidates = []
    const allParts = [msgData.payload, ...getAllParts(msgData.payload)]
    for (const part of allParts) {
      if (part?.filename) candidates.push({ source: 'PJ', text: part.filename })
      // Décode le corps texte/html (body.data en base64url)
      const mime = part?.mimeType || ''
      const data = part?.body?.data
      if (data && (mime.startsWith('text/') || mime === '')) {
        try {
          const decoded = Buffer.from(data, 'base64').toString('utf8')
          if (decoded) candidates.push({ source: mime || 'body', text: decoded })
        } catch (e) { /* ignore decode error */ }
      }
    }
    const subject = (msgData.payload?.headers || []).find(h => (h.name || '').toLowerCase() === 'subject')?.value || ''
    if (subject) candidates.push({ source: 'sujet', text: subject })
    if (msgData.snippet) candidates.push({ source: 'snippet', text: msgData.snippet })

    // Accepte plusieurs mois dans un seul mail (cas Sergio : mars + avril en PJ groupées)
    const processedMois = new Set()
    const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    for (const cand of candidates) {
      const text = cand.text.toUpperCase()
      for (const refMatch of text.matchAll(/NR(\d{2})(\d{2})-([A-Z]+)/g)) {
        const refM = refMatch[1]
        const refY = "20" + refMatch[2]
        const refTrigramme = refMatch[3]
        const refMois = `${refM}-${refY}`
        const ref = `NR${refM}${refMatch[2]}-${refTrigramme}`

        // Refuse les mois futurs (current month autorisé)
        const refDate = new Date(parseInt(refY), parseInt(refM) - 1, 1)
        if (refDate > curMonthStart) continue
        if (refTrigramme !== trigramme) continue
        if (processedMois.has(refMois)) continue
        processedMois.add(refMois)

        console.log(`📎 Match ${cand.source}: ${ref} (${refMois})`)
        const statutRef = db.collection('paiements').doc(refMois).collection('statuts').doc(ch.id)
        const existing = await statutRef.get()
        if (!existing.exists || !existing.data().factureRecue) {
          await statutRef.set({ factureRecue: true }, { merge: true })
          console.log(`✅ Facture reçue: ${ref} → ${ch.email} (${refMois})`)
        }
      }
    }
  }
}

console.log(`✅ checkGmailFactures terminé`)
    return null
  })

// =============================================================================
// Rappels pointage / récap / restocks → ping de l'endpoint Vercel toutes les 5 min
// L'endpoint /api/cron/reminders calcule lui-même l'heure de Paris et déclenche
// les notifs au bon moment (12h10, 12h30, 12h50/15h50/17h50, 19h55).
// =============================================================================
exports.pingReminders = functions
  .region("europe-west1")
  .pubsub.schedule("every 5 minutes")
  .timeZone("Europe/Paris")
  .onRun(async () => {
    const fetch = require('node-fetch')
    const url = 'https://www.nouvellerive.eu/api/cron/reminders'
    const secret = process.env.CRON_SECRET || ''
    try {
      const res = await fetch(url, {
        headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      })
      const body = await res.text()
      console.log(`pingReminders ${res.status}: ${body.slice(0, 200)}`)
    } catch (err) {
      console.error('pingReminders failed:', err)
    }
    return null
  })

// =============================================================================
// Sync ventes eBay → ping de l'endpoint Vercel toutes les 10 min
// L'API de notifications eBay ne pousse pas les ventes ; le polling Fulfillment
// est la méthode officielle. Idempotent (IDs déterministes côté Firestore).
// =============================================================================
exports.pingEbaySync = functions
  .region("europe-west1")
  .pubsub.schedule("every 60 minutes")
  .timeZone("Europe/Paris")
  .onRun(async () => {
    const fetch = require('node-fetch')
    const url = 'https://www.nouvellerive.eu/api/sync/ebay-orders'
    const secret = process.env.CRON_SECRET || ''
    try {
      const res = await fetch(url, {
        headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      })
      const body = await res.text()
      console.log(`pingEbaySync ${res.status}: ${body.slice(0, 200)}`)
    } catch (err) {
      console.error('pingEbaySync failed:', err)
    }
    return null
  })

// =============================================================================
// Watch Gmail nouvelleriveachats@ pour les mails Vinted/transporteurs.
// Toutes les 5 min : on récupère les mails non lus matchant nos parsers et on
// les POST à /api/webhooks/gmail-achats. La route Next.js parse + écrit dans
// Firestore (chineuse NR, source='achat-vinted', etc.). Une fois traité avec
// succès, on enlève le label UNREAD du mail pour ne pas le retraiter.
//
// Env requis :
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  (déjà utilisés par checkGmailFactures)
//   GOOGLE_REFRESH_TOKEN_ACHATS             (OAuth refresh token spécifique au compte achats)
//   NR_INTERNAL_TOKEN                       (auth partagé avec la route Next.js)
// =============================================================================
exports.gmailWatcherAchats = functions
  .region("europe-west1")
  .pubsub.schedule("every day 09:00")
  .timeZone("Europe/Paris")
  .onRun(async () => {
    const fetch = require('node-fetch')

    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN_ACHATS
    const internalToken = process.env.NR_INTERNAL_TOKEN
    if (!refreshToken || !internalToken) {
      console.error('gmailWatcherAchats: GOOGLE_REFRESH_TOKEN_ACHATS / NR_INTERNAL_TOKEN manquants')
      return null
    }

    // 1. Échange du refresh token contre un access token court
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    const tokenJson = await tokenRes.json()
    if (!tokenJson.access_token) {
      console.error('gmailWatcherAchats: pas d\'access_token, réponse:', JSON.stringify(tokenJson))
      return null
    }
    const accessToken = tokenJson.access_token

    // 2. Recherche des mails non lus en provenance de nos parsers connus
    const senders = [
      'no-reply@vinted.fr',
      'noreply@mondialrelay.fr',
      'avisage-ne-pas-repondre@chronopost.fr',
      'chronopost@network1.pickup.fr',
    ]
    const query = encodeURIComponent(`is:unread (${senders.map((e) => `from:${e}`).join(' OR ')})`)
    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const listJson = await listRes.json()
    if (listJson.error) {
      console.error('gmailWatcherAchats: erreur list:', JSON.stringify(listJson.error))
      return null
    }
    const messages = listJson.messages || []
    if (messages.length === 0) {
      console.log('gmailWatcherAchats: aucun nouveau mail')
      return null
    }
    console.log(`gmailWatcherAchats: ${messages.length} mail(s) à traiter`)

    const baseUrl = process.env.NR_BASE_URL || 'https://www.nouvellerive.eu'

    // 3. Pour chaque mail : récupère le corps, POST à la route, marque comme lu
    for (const m of messages) {
      try {
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        const msg = await msgRes.json()
        if (msg.error) {
          console.error(`gmailWatcherAchats ${m.id}: erreur get:`, JSON.stringify(msg.error))
          continue
        }

        const headers = {}
        for (const h of msg.payload?.headers || []) headers[h.name] = h.value
        const from = headers['From'] || ''
        const subject = headers['Subject'] || ''
        const body = extractMessageBody(msg.payload)

        if (!body) {
          console.warn(`gmailWatcherAchats ${m.id}: pas de corps lisible, skip`)
          continue
        }

        // 4. Push vers la route Next.js
        const hookRes = await fetch(`${baseUrl}/api/webhooks/gmail-achats`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': internalToken,
          },
          body: JSON.stringify({ gmailMessageId: m.id, from, subject, body }),
        })
        const hookText = await hookRes.text()
        console.log(`gmailWatcherAchats ${m.id} → ${hookRes.status}: ${hookText.slice(0, 200)}`)

        // 5. Marquer comme lu uniquement si le webhook a confirmé ok
        if (hookRes.ok) {
          await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}/modify`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
            }
          )
        }
      } catch (err) {
        console.error(`gmailWatcherAchats ${m.id}: exception`, err)
      }
    }

    return null
  })

/**
 * Extrait le corps texte d'un payload Gmail (multi-part possible).
 * Préfère text/html, sinon text/plain. Décode le base64url.
 */
function extractMessageBody(payload) {
  if (!payload) return ''
  const decode = (data) => Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')

  // Cas mono-part
  if (payload.body && payload.body.data) {
    return decode(payload.body.data)
  }

  // Cas multi-part : on cherche text/html d'abord, puis text/plain
  const parts = payload.parts || []
  const html = findPartByMime(parts, 'text/html')
  if (html?.body?.data) return decode(html.body.data)
  const plain = findPartByMime(parts, 'text/plain')
  if (plain?.body?.data) return decode(plain.body.data)
  return ''
}

function findPartByMime(parts, mime) {
  for (const p of parts) {
    if (p.mimeType === mime && p.body?.data) return p
    if (p.parts) {
      const sub = findPartByMime(p.parts, mime)
      if (sub) return sub
    }
  }
  return null
}

// --- Sitemap cache : pré-calcule la liste d'URLs pour éviter le timeout Googlebot ---
// Le sitemap Next.js lit `_meta/sitemap-cache` (1 doc, ~50ms) au lieu de scanner tous les produits.
const SITEMAP_LUXURY_BRANDS = [
  'hermès', 'hermes', 'chanel', 'louis vuitton', 'lv', 'dior', 'christian dior',
  'céline', 'celine', 'yves saint laurent', 'ysl', 'saint laurent', 'gucci',
  'burberry', 'givenchy', 'lanvin', 'nina ricci', 'balenciaga', 'bottega veneta',
  'prada', 'fendi', 'valentino', 'loewe', 'cartier', 'van cleef', 'boucheron',
]

function sitemapSlugify(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}
function sitemapStripTrigramme(s) {
  return String(s || '').replace(/^[A-Z]{2,10}\d{0,4}\s*[-–]\s*/i, '').trim()
}
function sitemapCategorieLabel(cat) {
  if (typeof cat === 'string') return cat
  if (cat && typeof cat === 'object' && typeof cat.label === 'string') return cat.label
  return ''
}
function sitemapTypeSlug(cat) {
  return sitemapSlugify(sitemapStripTrigramme(sitemapCategorieLabel(cat))) || 'piece'
}
function sitemapBuildPath(p) {
  const type = sitemapTypeSlug(p.categorie)
  const marque = sitemapSlugify(p.marque || '') || 'sm'
  const nom = sitemapStripTrigramme(p.nom || '')
  const desc = [p.marque, nom, p.color, p.taille].filter(Boolean).join(' ')
  const descSlug = sitemapSlugify(desc).slice(0, 80) || 'piece'
  return `${type}/${marque}/${descSlug}-${p.id}`
}

exports.regenSitemapCache = functions
  .region('europe-west1')
  .runWith({ memory: '512MB', timeoutSeconds: 300 })
  .pubsub.schedule('every 60 minutes')
  .onRun(async () => {
    const snap = await db.collection('produits')
      .select('statut', 'vendu', 'quantite', 'prix', 'photos', 'imageUrls', 'imageUrl', 'marque', 'categorie', 'nom', 'color', 'taille')
      .get()

    const luxurySlugs = new Set(SITEMAP_LUXURY_BRANDS.map(sitemapSlugify))
    const paths = []
    const typeSet = new Set()
    const luxuryBrandSet = new Set()

    for (const doc of snap.docs) {
      const p = { id: doc.id, ...doc.data() }
      if (p.statut === 'supprime' || p.statut === 'retour') continue
      if (p.vendu === true) continue
      if ((p.quantite == null ? 1 : p.quantite) <= 0) continue
      if (!p.prix || p.prix <= 0) continue
      if (!(p.photos && p.photos.face) && !(p.imageUrls && p.imageUrls[0]) && !p.imageUrl) continue

      const type = sitemapTypeSlug(p.categorie)
      if (type && type !== 'piece') typeSet.add(type)
      if (p.marque) {
        const bSlug = sitemapSlugify(p.marque)
        if (luxurySlugs.has(bSlug)) luxuryBrandSet.add(bSlug)
      }
      paths.push(sitemapBuildPath(p))
    }

    await db.doc('_meta/sitemap-cache').set({
      paths,
      types: Array.from(typeSet),
      luxuryBrands: Array.from(luxuryBrandSet),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log(`✅ Sitemap cache: ${paths.length} produits, ${typeSet.size} types, ${luxuryBrandSet.size} luxe`)
    return null
  })