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