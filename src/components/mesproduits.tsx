"use client";

import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { db } from "../lib/firebaseConfig";
import { collection, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { auth } from "@/lib/firebaseConfig";

export default function MesProduits() {
  const [produitsDisponibles, setProduitsDisponibles] = useState<any[]>([]);
  const [produitsVendus, setProduitsVendus] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (currentUser?.email) {
      setEmail(currentUser.email);
      chargerProduits(currentUser.email);
    }
  }, []);

  const chargerProduits = async (email: string) => {
    try {
      const q = query(collection(db, "produits"), where("revendeur", "==", email));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProduitsDisponibles(docs.filter((p) => !p.vendu));
      setProduitsVendus(docs.filter((p) => p.vendu));
    } catch (err) {
      console.error("Erreur Firestore:", err);
      setErreur("Erreur de chargement des produits.");
    }
  };

  const supprimerProduit = async (id: string) => {
    try {
      await deleteDoc(doc(db, "produits", id));
      setProduitsDisponibles((prev) => prev.filter((p) => p.id !== id));
      setProduitsVendus((prev) => prev.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Erreur suppression:", error);
      alert("Erreur lors de la suppression.");
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Mes produits 🧾</h1>
      {erreur && <p className="text-red-600 mb-4">{erreur}</p>}

      <h2 className="text-lg font-semibold mt-6 mb-2">🛍 Produits disponibles</h2>
      {produitsDisponibles.length === 0 ? (
        <p>Aucun produit disponible.</p>
      ) : (
        <ul className="grid gap-4">
          {produitsDisponibles.map((p) => (
            <li key={p.id} className="border p-4 rounded relative">
              <p className="font-semibold">{p.nom}</p>
              <p className="text-sm">Catégorie : {p.typologie}</p>
              <p className="text-sm">Prix : {p.prix} €</p>
              {p.description && <p className="text-sm italic">{p.description}</p>}
              {p.photoURL && <img src={p.photoURL} alt={p.nom} className="mt-2 h-32 w-full object-cover rounded" />}
              <p className="text-yellow-700 mt-2">🛍 Disponible</p>
              <button
                onClick={() => supprimerProduit(p.id)}
                className="absolute top-2 right-2 text-sm text-red-600 hover:underline"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="text-lg font-semibold mt-10 mb-2">✅ Produits vendus</h2>
      {produitsVendus.length === 0 ? (
        <p>Aucun produit vendu.</p>
      ) : (
        <ul className="grid gap-4">
          {produitsVendus.map((p) => (
            <li key={p.id} className="border p-4 rounded">
              <p className="font-semibold">{p.nom}</p>
              <p className="text-sm">Catégorie : {p.typologie}</p>
              <p className="text-sm">Prix : {p.prix} €</p>
              {p.description && <p className="text-sm italic">{p.description}</p>}
              {p.photoURL && <img src={p.photoURL} alt={p.nom} className="mt-2 h-32 w-full object-cover rounded" />}
              <p className="text-green-700 font-semibold mt-2">Vendu le {new Date(p.dateVente?.seconds * 1000).toLocaleDateString()}</p>
              <button
                onClick={() => supprimerProduit(p.id)}
                className="mt-2 text-sm text-red-600 hover:underline"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
