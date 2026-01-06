// functions/sync-square.js
const admin = require("firebase-admin");
const { Client, Environment } = require("square");
const { v4: uuidv4 } = require("uuid");
const fetch = require("node-fetch");
const FormData = require("form-data");

// Init Firebase avec le service account
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// Init Square
const squareClient = new Client({
  accessToken: "EAAAl47KiVln6ChvRD8zUXqLU4LWjc4-7VSJfUEsBOm5QE4IBUiR_ChKoi3OBJm9",
  environment: Environment.Production,
});
const locationId = "L9SXWZQHWAJF4";

async function syncAllProducts() {
  console.log("🚀 Début de la synchronisation Firestore → Square\n");

  // 1. Récupérer tous les produits avec variationId
  const snapshot = await db.collection("produits").get();
  const produits = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((p) => p.variationId && !p.vendu && p.statut !== "supprime" && p.statut !== "retour");

  console.log(`📦 ${produits.length} produits à vérifier\n`);

  let updated = 0;
  let photosUploaded = 0;
  let errors = 0;

  for (const produit of produits) {
    try {
      // 2. Récupérer l'état actuel dans Square
      const { result } = await squareClient.catalogApi.retrieveCatalogObject(
        produit.variationId,
        true
      );

      const squareVariation = result.object;
      const squarePrice = Number(squareVariation?.itemVariationData?.priceMoney?.amount || 0) / 100;
      const squareName = squareVariation?.itemVariationData?.name || "";

      const firestorePrice = produit.prix || 0;
      const firestoreName = produit.nom || "";

      // 3. Comparer et mettre à jour si différent
      const prixDiff = Math.abs(squarePrice - firestorePrice) > 0.01;
      const nomDiff = squareName !== firestoreName;

      if (prixDiff || nomDiff) {
        console.log(`\n🔄 ${produit.sku}:`);
        if (prixDiff) console.log(`   Prix: ${squarePrice}€ → ${firestorePrice}€`);
        if (nomDiff) console.log(`   Nom: "${squareName}" → "${firestoreName}"`);

        // Récupérer les versions pour la mise à jour
        const itemId = produit.itemId || produit.catalogObjectId;
        const { result: itemResult } = await squareClient.catalogApi.retrieveCatalogObject(itemId);
        const itemVersion = itemResult.object?.version;
        const variationVersion = squareVariation?.version;

        await squareClient.catalogApi.batchUpsertCatalogObjects({
          idempotencyKey: uuidv4(),
          batches: [
            {
              objects: [
                {
                  type: "ITEM",
                  id: itemId,
                  version: itemVersion,
                  itemData: {
                    name: firestoreName,
                    description: produit.description || "",
                    variations: [
                      {
                        type: "ITEM_VARIATION",
                        id: produit.variationId,
                        version: variationVersion,
                        itemVariationData: {
                          itemId: itemId,
                          name: firestoreName,
                          sku: produit.sku,
                          pricingType: "FIXED_PRICING",
                          priceMoney: {
                            amount: Math.round(firestorePrice * 100),
                            currency: "EUR",
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        });

        console.log(`   ✅ Mis à jour`);
        updated++;
      }

      // 4. Vérifier et uploader la photo si manquante
      const { result: itemWithImages } = await squareClient.catalogApi.retrieveCatalogObject(
        produit.itemId || produit.catalogObjectId,
        true
      );
      
      const hasImage = itemWithImages.object?.itemData?.imageIds?.length > 0;
      const imageUrl = produit.photos?.face || produit.imageUrl || (produit.imageUrls && produit.imageUrls[0]);

      if (!hasImage && imageUrl) {
        console.log(`\n📷 ${produit.sku}: Upload photo...`);

        try {
          const imageResponse = await fetch(imageUrl);
          const imageBuffer = await imageResponse.buffer();

          const formData = new FormData();
          formData.append("file", imageBuffer, {
            filename: "product.jpg",
            contentType: "image/jpeg",
          });

          const metadata = {
            idempotency_key: uuidv4(),
            object_id: produit.itemId || produit.catalogObjectId,
            image: {
              type: "IMAGE",
              id: `#image-${Date.now()}`,
              image_data: {
                caption: produit.nom,
              },
            },
          };
          formData.append("request", JSON.stringify(metadata), {
            contentType: "application/json",
          });

          const uploadResponse = await fetch(
            "https://connect.squareup.com/v2/catalog/images",
            {
              method: "POST",
              headers: {
                Authorization: "Bearer EAAAl47KiVln6ChvRD8zUXqLU4LWjc4-7VSJfUEsBOm5QE4IBUiR_ChKoi3OBJm9",
                "Square-Version": "2023-09-25",
                ...formData.getHeaders(),
              },
              body: formData,
            }
          );

          if (uploadResponse.ok) {
            console.log(`   ✅ Photo uploadée`);
            photosUploaded++;
          } else {
            const err = await uploadResponse.text();
            console.log(`   ⚠️ Erreur photo: ${err}`);
          }
        } catch (imgErr) {
          console.log(`   ⚠️ Erreur photo: ${imgErr.message}`);
        }
      }

      // Pause pour éviter les rate limits
      await new Promise((r) => setTimeout(r, 100));

    } catch (err) {
      console.log(`\n❌ ${produit.sku}: ${err.message}`);
      errors++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`✅ Terminé !`);
  console.log(`   - ${updated} produits mis à jour`);
  console.log(`   - ${photosUploaded} photos uploadées`);
  console.log(`   - ${errors} erreurs`);
}

// Lancer le script
syncAllProducts()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Erreur fatale:", err);
    process.exit(1);
  });