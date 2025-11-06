const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Client, Environment } = require("square");

admin.initializeApp();
const db = admin.firestore();

// Configure Square client
const squareClient = new Client({
  accessToken: "EAAAEDacADsGzZx3vLkWmCK5EUZCG", // ← ton token Square
  environment: Environment.Production,
});
const locationId = "LRNQ2NP5KXKZ6"; // ← ton location ID Square

exports.syncSquareToFirestore = functions.pubsub.schedule("every 12 hours").onRun(async () => {
  try {
    const response = await squareClient.ordersApi.searchOrders({
      locationIds: [locationId],
      query: {
        filter: {
          stateFilter: {
            states: ["COMPLETED"],
          },
        },
      },
    });

    const orders = response.result.orders || [];

    for (const order of orders) {
      const lineItems = order.lineItems || [];
      for (const item of lineItems) {
        const produitId = item.catalogObjectId;
        const date = order.closedAt;

        if (produitId && date) {
          const ref = db.collection("produits").doc(produitId);
          const doc = await ref.get();
          if (doc.exists && !doc.data().vendu) {
            await ref.update({
              vendu: true,
              dateVente: admin.firestore.Timestamp.fromDate(new Date(date)),
            });
          }
        }
      }
    }

    console.log(`✅ ${orders.length} commandes traitées.`);
  } catch (error) {
    console.error("❌ Erreur lors de la synchronisation :", error);
  }
});
