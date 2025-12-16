const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const { SquareClient } = require("square");

admin.initializeApp();
const db = admin.firestore();

// Configure Square client
const squareClient = new SquareClient({
  token: "EAAAEDacADsGzZx3vLkWmCK5EUZCG",
  environment: "production",
});
const locationId = "LRNQ2NP5KXKZ6";

// ============================================
// Créer produit dans Square quand reçu en boutique
// ============================================
exports.onProductReceived = functions.firestore
  .document("produits/{productId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const productId = context.params.productId;

    // Vérifier si recu passe de false à true
    if (before.recu === false && after.recu === true) {
      console.log(`📦 Produit reçu: ${productId} (${after.sku})`);

      if (!after.sku) {
        console.log(`⚠️ Pas de SKU pour ${productId}, skip Square`);
        return null;
      }

      // Vérifier si le produit existe déjà dans Square (par SKU)
      try {
        const searchResult = await squareClient.catalog.search({
          objectTypes: ["ITEM_VARIATION"],
          query: {
            exactQuery: {
              attributeName: "sku",
              attributeValue: after.sku,
            },
          },
        });

        if (searchResult.objects && searchResult.objects.length > 0) {
          console.log(`⏭️ Produit ${after.sku} existe déjà dans Square`);
          return null;
        }
      } catch (searchError) {
        console.error("Erreur recherche Square:", searchError);
      }

      // Récupérer categoryId
      let categoryId = null;
      if (after.categorie && typeof after.categorie === "object" && after.categorie.idsquare) {
        categoryId = after.categorie.idsquare;
      }

      // Construire la description
      const descParts = [];
      if (after.marque) descParts.push(`Marque: ${after.marque}`);
      if (after.taille) descParts.push(`Taille: ${after.taille}`);
      if (after.description) descParts.push(after.description);
      const finalDescription = descParts.join("\n");

      // Créer dans Square
      try {
        const idempotencyKey = `${productId}-${Date.now()}`;
        
        const result = await squareClient.catalog.upsertObject({
          idempotencyKey,
          object: {
            type: "ITEM",
            id: `#item_${after.sku}`,
            presentAtAllLocations: true,
            itemData: {
              name: after.nom,
              description: finalDescription,
              categoryId: categoryId || undefined,
              variations: [
                {
                  type: "ITEM_VARIATION",
                  id: `#variation_${after.sku}`,
                  presentAtAllLocations: true,
                  itemVariationData: {
                    itemId: `#item_${after.sku}`,
                    name: "Default",
                    sku: after.sku,
                    pricingType: "FIXED_PRICING",
                    priceMoney: {
                      amount: BigInt(Math.round((after.prix || 0) * 100)),
                      currency: "EUR",
                    },
                    trackInventory: true,
                  },
                },
              ],
            },
          },
        });

        const itemId = result.catalogObject?.id;
        const variationId = result.catalogObject?.itemData?.variations?.[0]?.id;

        console.log(`✅ Créé dans Square: ${after.sku} → item=${itemId}, variation=${variationId}`);

        // Mettre à jour le stock
        if (variationId) {
          await squareClient.inventory.batchChange({
            idempotencyKey: `${productId}-stock-${Date.now()}`,
            changes: [
              {
                type: "PHYSICAL_COUNT",
                physicalCount: {
                  catalogObjectId: variationId,
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
          itemId: itemId || null,
          variationId: variationId || null,
          catalogObjectId: itemId || null,
          squareSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

      } catch (squareError) {
        console.error(`❌ Erreur création Square pour ${after.sku}:`, squareError);
      }
    }

    return null;
  });