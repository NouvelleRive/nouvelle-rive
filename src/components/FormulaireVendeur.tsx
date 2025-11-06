"use client";

import { useState, useEffect } from "react";
import { auth } from "../lib/firebaseConfig"; // ← auth initialisé
import * as XLSX from "xlsx";
import { db } from "../lib/firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";

const vendeursMap: Record<string, string[]> = {
  "info@aerea.studio": [],
  "darkvintage25@gmail.com": ["DV - Ensemble", "DV - Chaussures", "DV - Haut", "DV - Jupe", "DV - Robe", "DV - Pantalon", "DV - Veste / Manteau"],
  "studio.inespineau@gmail.com": ["IP - Bague", "IP - Boucles d'oreilles", "IP - Bracelet", "IP - Broche", "IP - Charms", "IP - Collier"],
  "laura.seror.pro@gmail.com": ["MB - Ensemble", "MB - Chaussures", "MB - Haut", "MB - Jupe", "MB - Robe", "MB - Pantalon", "MB - Sac", "MB - Veste / Manteau"],
  "Maisonhouni@gmail.com": ["HOU - Ensemble", "HOU - Chaussures", "HOU - Haut", "HOU - Jupe", "HOU - Robe", "HOU - Pantalon", "HOU - Sac", "HOU - Veste / Manteau"],
  "mathilde.royer226@gmail.com": [],
  "alexandra@theparisianvintage.com": ["PV - Ensemble", "PV - Chaussures", "PV - Haut", "PV - Jupe", "PV - Robe", "PV - Pantalon", "PV - Sac", "PV - Veste / Manteau"],
  "sophieactisbonage@gmail.com": ["BON - Ensemble", "BON - Chaussures", "BON - Haut", "BON - Jupe", "BON - Robe", "BON - Pantalon", "BON - Veste / Manteau"],
  "lea@personalsellerparis.com": ["PS - Ensemble", "PS - Chaussures", "PS - Haut", "PS - Jupe", "PS - Robe", "PS - Pantalon", "PS - Sac", "PS - Veste / Manteau"],
  "pristiniparis@gmail.com": ["PRI - Ensemble", "PRI - Chaussures", "PRI - Haut", "PRI - Jupe", "PRI - Robe", "PRI - Pantalon", "PRI - Sac", "PRI - Veste / Manteau"],
  "contactgigiparis@gmail.com": ["GIGI - Bague", "GIGI - Boucles d'oreilles", "GIGI - Bracelet", "GIGI - Broche", "GIGI - Charms", "GIGI - Collier"],
  "rdlcweb@gmail.com": ["TAC - Ensemble", "TAC - Casquette", "TAC - Chaussures", "TAC - Haut", "TAC - Jupe", "TAC - Robe", "TAC - Pantalon", "TAC - Sac", "TAC - Veste / Manteau"],
  "contact@tete-dorange.com": ["TDO - Bague", "TDO - Boucles d'oreilles", "TDO - Bracelet", "TDO - Broche", "TDO - Charms", "TDO - Collier"]
};

export default function FormulaireVendeur() {
  const [email, setEmail] = useState("");
  const [nom, setNom] = useState("");
  const [categorie, setCategorie] = useState("");
  const [prix, setPrix] = useState("");
  const [codeBarres, setCodeBarres] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const [categoriesDisponibles, setCategoriesDisponibles] = useState<string[]>([]);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser?.email) {
      setEmail(currentUser.email);
      setCategoriesDisponibles(vendeursMap[currentUser.email] || []);
    }
  }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setPhoto(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom || !categorie || !prix || !photo) {
      setConfirmation("Merci de remplir tous les champs obligatoires et d’ajouter une photo.");
      return;
    }

    const formData = new FormData();
    formData.append("nom", nom);
    formData.append("typologie", categorie);
    formData.append("prix", prix);
    formData.append("codeBarres", codeBarres);
    formData.append("description", description);
    formData.append("photo", photo);

    try {
      const currentUser = auth.currentUser;
      const token = currentUser ? await currentUser.getIdToken() : "";

      const res = await fetch("/api/produits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        setConfirmation("✅ Pièce ajoutée avec succès !");
        setNom("");
        setCategorie("");
        setPrix("");
        setCodeBarres("");
        setDescription("");
        setPhoto(null);
      } else {
        setConfirmation("❌ Erreur lors de l’ajout.");
      }
    } catch (error) {
      console.error(error);
      setConfirmation("❌ Erreur réseau.");
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const produits = XLSX.utils.sheet_to_json(sheet);

      const currentUser = auth.currentUser;
      const token = currentUser ? await currentUser.getIdToken() : "";

      for (const produit of produits) {
        const res = await fetch("/api/produits", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(produit),
        });

        if (!res.ok) {
          console.error("Erreur import produit:", await res.text());
        }
      }

      setImportMessage("✅ Produits importés avec succès !");
    } catch (error) {
      console.error("Erreur import:", error);
      setImportMessage("❌ Erreur lors de l'import du fichier.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
      <label className="cursor-pointer text-blue-600 underline mb-4 inline-block">
        📥 Importer mes produits en Excel
        <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileImport} />
      </label>
      {importMessage && <p className="text-sm text-gray-600 mb-6">{importMessage}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" placeholder="Nom de la pièce" value={nom} onChange={(e) => setNom(e.target.value)} className="w-full border border-gray-300 px-4 py-2 rounded-md" />
        <select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="w-full border border-gray-300 px-4 py-2 rounded-md">
          <option value="">-- Choisir une catégorie --</option>
          {categoriesDisponibles.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <input type="number" placeholder="Prix (€)" value={prix} onChange={(e) => setPrix(e.target.value)} className="w-full border border-gray-300 px-4 py-2 rounded-md" />
        <input type="text" placeholder="Code-barres (facultatif)" value={codeBarres} onChange={(e) => setCodeBarres(e.target.value)} className="w-full border border-gray-300 px-4 py-2 rounded-md" />
        <input type="text" placeholder="Description (facultatif)" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full border border-gray-300 px-4 py-2 rounded-md" />
        <div>
          <label htmlFor="photo" className="inline-block bg-gray-100 border border-gray-300 rounded px-4 py-2 cursor-pointer hover:bg-gray-200 text-center">
            📸 {photo ? "Photo sélectionnée ✅" : "Ajouter une photo"}
          </label>
          <input id="photo" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
        </div>
        <button type="submit" className="bg-[#22209C] text-white py-2 px-4 rounded-md hover:bg-[#1a187a] transition">
          Ajouter la pièce
        </button>
        {confirmation && <p className="mt-4 text-sm text-center text-gray-700">{confirmation}</p>}
      </form>
    </div>
  );
}
