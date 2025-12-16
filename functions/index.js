const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { Client, Environment } = require("square");
const { v4: uuidv4 } = require("uuid");

admin.initializeApp();
const db = admin.firestore();

const squareClient = new Client({
  accessToken: "EAAAEDacADsGzZx3vLkWmCK5EUZCG",
  environment: Environment.Production,
});

const locationId = "LRNQ2NP5KXKZ6";

// ============================================
// TRIGGER: Produit reçu → créer dans Square
// ============================================
exports.onProductReceived = functions.firestore
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

      // Construire l'objet Square exactement comme l'ancien code
      const itemData = {
        type: "ITEM",
        id: itemId,
        itemData: {
          name: after.nom,
          description: after.description || "",
          categoryId: after.categorie?.idsquare || undefined,
          variations: [
            {
              type: "ITEM_VARIATION",
              id: variationId,
              itemVariationData: {
                itemId: itemId,
                name: after.nom,
                sku: after.sku,
                pricingType: "FIXED_PRICING",
                priceMoney: {
                  amount: BigInt(Math.round((after.prix || 0) * 100)),
                  currency: "EUR",
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

      try {
        // Créer dans Square avec batchUpsertCatalogObjects
        const { result } = await squareClient.catalogApi.batchUpsertCatalogObjects({
          idempotencyKey,
          batches: [{ objects: [itemData] }],
        });

        // Mapper les IDs
        let realItemId = null;
        let realVariationId = null;

        if (result.idMappings) {
          for (const mapping of result.idMappings) {
            const clientId = mapping.clientObjectId || "";
            const realId = mapping.objectId || "";

            if (clientId.startsWith("#item_")) {
              realItemId = realId;
            } else if (clientId.startsWith("#variation_")) {
              realVariationId = realId;
            }
          }
        }

        console.log(`✅ Créé dans Square: ${after.sku} → item=${realItemId}, variation=${realVariationId}`);

        // Mettre à jour le stock
        if (realVariationId) {
          await squareClient.inventoryApi.batchChangeInventory({
            idempotencyKey: uuidv4(),
            changes: [
              {
                type: "PHYSICAL_COUNT",
                physicalCount: {
                  catalogObjectId: realVariationId,
                  locationId,
                  quantity: String(after.quantite || 1),
                  state: "IN_STOCK",
                  occurredAt: new Date().toISOString(),
                },
              },
            ],
          });
          console.log(`✅ Stock mis à jour: ${after.quantite || 1}`);
        }

        // Sauvegarder les IDs Square dans Firestore
        await change.after.ref.update({
          catalogObjectId: realItemId,
          variationId: realVariationId,
          itemId: realItemId,
          squareSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      } catch (squareError) {
        console.error(`❌ Erreur création Square pour ${after.sku}:`, squareError);
      }
    }

    // CAS 2: Produit passe en retour → supprimer de Square
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

// ============================================
// TRIGGER: Produit supprimé → supprimer de Square
// ============================================
exports.onProductDeleted = functions.firestore
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