import { NextRequest, NextResponse } from "next/server";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getApps, initializeApp as initAdminApp, cert } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";

// Init Firebase Client SDK
const firebaseClientConfig = {
  apiKey: "AIzaSyCHAQITC3n40WDQXLN4OAflmlE5lNG42SM",
  authDomain: "nouvelle-rive.firebaseapp.com",
  projectId: "nouvelle-rive",
  storageBucket: "nouvelle-rive.appspot.com",
  messagingSenderId: "367296973767",
  appId: "1:367296973767:web:c2d7d502bfe41e5db067e2",
};
const app = initializeApp(firebaseClientConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Init Firebase Admin SDK
if (!getApps().length) {
  initAdminApp();
}
const adminAuth = getAdminAuth();

const vendeursMap: Record<string, string> = {
  "nouvelleriveparis@gmail.com": "NOUVELLE RIVE"
  "darkvintage25@gmail.com": "DARK VINTAGE",
  "laura.seror.pro@gmail.com": "MAISON BÉGUIN",
  "studio.inespineau@gmail.com": "INES PINEAU",
  "info@aerea.studio": "AEREA"
  "Maisonhouni@gmail.com": "MAISON HOUNI"
  "mathilde.royer226@gmail.com": "MAKI CORP"
  "alexandra@theparisianvintage.com": "PARISIAN VINTAGE"
  "sophieactisbonage@gmail.com": "BONAGE"
  "lea@personalsellerparis.com": "PERSONAL SELLER"
  "pristiniparis@gmail.com": "PRISTINI"
  "contactgigiparis@gmail.com": "GIGI PARIS"
  "rdlcweb@gmail.com": "SERGIO TACCHINERIE" 
  "contact@tete-dorange.com": "TÊTE D'ORANGE" 
  // ajoute les autres
};
};

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.split("Bearer ")[1];

  if (!token) return new Response("Non connecté", { status: 401 });

  let email = "";
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    email = decoded.email || "";
  } catch (err) {
    return new Response("Token invalide", { status: 403 });
  }

  const revendeur = vendeursMap[email] || "Revendeur inconnu";

  if (req.headers.get("content-type")?.includes("application/json")) {
    // Cas import Excel : JSON sans image
    const data = await req.json();
    const nom = data.nom;
    const typologie = data.typologie || data.categorie;
    const prix = parseFloat(data.prix);
    const codeBarres = data.codeBarres || "";
    const description = data.description || "";

    await addDoc(collection(db, "produits"), {
      nom,
      typologie,
      prix,
      codeBarres,
      description,
      revendeur,
      createdAt: new Date(),
    });

    await sendToSquare({ nom, typologie, prix, codeBarres, revendeur });

    return NextResponse.json({ status: "OK" });
  }

  // Cas formulaire classique avec photo
  const formData = await req.formData();
  const nom = formData.get("nom") as string;
  const typologie = formData.get("typologie") as string;
  const prix = parseFloat(formData.get("prix") as string);
  const codeBarres = formData.get("codeBarres") as string;
  const description = formData.get("description") as string;
  const photo = formData.get("photo") as File;

  let photoURL = "";
  if (photo) {
    const bytes = await photo.arrayBuffer();
    const photoRef = ref(storage, `photos/${Date.now()}_${photo.name}`);
    await uploadBytes(photoRef, new Uint8Array(bytes));
    photoURL = await getDownloadURL(photoRef);
  }

  await addDoc(collection(db, "produits"), {
    nom,
    typologie,
    prix,
    codeBarres,
    description,
    photoURL,
    revendeur,
    createdAt: new Date(),
  });

  await sendToSquare({ nom, typologie, prix, codeBarres, revendeur });

  return NextResponse.json({ status: "OK" });
}

async function sendToSquare({
  nom,
  typologie,
  prix,
  codeBarres,
  revendeur,
}: {
  nom: string;
  typologie: string;
  prix: number;
  codeBarres: string;
  revendeur: string;
}) {
  const squareAccessToken = "EAAAl47KiVln6ChvRD8zUXqLU4LWjc4-7VSJfUEsBOm5QE4IBUiR_ChKoi3OBJm9";
  const priceInCents = Math.round(prix * 100);

  await fetch("https://connect.squareup.com/v2/catalog/object", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${squareAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      object: {
        type: "ITEM",
        id: "#temp-id-" + Math.random().toString(36).substring(2, 15),
        item_data: {
          name: nom,
          description: "Ajouté depuis l’app Nouvelle Rive",
          abbreviation: nom.slice(0, 3).toUpperCase(),
          category_id: undefined,
          available_online: false,
          variations: [
            {
              type: "ITEM_VARIATION",
              id: "#temp-variation",
              item_variation_data: {
                name: "Standard",
                pricing_type: "FIXED_PRICING",
                price_money: {
                  amount: priceInCents,
                  currency: "EUR",
                },
                sku: codeBarres || undefined,
              },
            },
          ],
        },
      },
    }),
  });
}
