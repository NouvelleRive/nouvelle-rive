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
  .pubsub.schedule("every 1 hours")
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

    for (const ch of chineuses) {
      const trigramme = (ch.trigramme || '').toUpperCase()
      if (!trigramme) continue

      const m = String(now.getMonth() + 1).padStart(2, '0')
      const y = String(now.getFullYear()).slice(-2)
      const ref = `NR${m}${y}-${trigramme}`

      // Chercher dans Gmail
      const query = encodeURIComponent(`"${ref}" has:attachment`)
      const gmailRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=5`,
        { headers: { Authorization: `Bearer ${access_token}` } }
      )
      const gmailData = await gmailRes.json()
      const found = !!(gmailData.messages && gmailData.messages.length > 0)

      if (found) {
        const statutRef = db.collection('paiements').doc(mois).collection('statuts').doc(ch.id)
        const existing = await statutRef.get()
        if (!existing.exists || !existing.data().factureRecue) {
          await statutRef.set({ factureRecue: true }, { merge: true })
          console.log(`✅ Facture reçue: ${ref}`)
        }
      }
    }

    return null
  })