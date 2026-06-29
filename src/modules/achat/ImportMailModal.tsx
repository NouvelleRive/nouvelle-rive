// Modal d'import achat en 2 étapes :
//   1. Tu colles → "Vérifier"  → appel /api/achat/preview-import (parse + ortho Claude)
//   2. Aperçu éditable des champs + saisie obligatoire du prix de vente → "Créer"
//      → appel /api/achat/import-manual avec les fields validés
//
// Multi-items (Whatnot peut contenir N commandes) : on affiche N cartes dans
// l'aperçu, chaque carte a son propre prix de vente.
//
// Outil temporaire — à retirer en même temps que les routes import quand le
// webhook Pub/Sub Gmail prend le relais.

'use client'

import { useRef, useState } from 'react'
import { X, Upload } from 'lucide-react'
import { auth } from '@/lib/firebaseConfig'

/**
 * Extrait le texte brut d'un PDF côté client via pdfjs-dist. On charge la lib
 * en dynamic import pour ne pas plomber le bundle initial (~2 Mo de worker).
 */
async function extractPdfText(file: File): Promise<string> {
  const pdfjs: any = await import('pdfjs-dist')
  // Worker chargé via CDN unpkg — évite la config webpack/Next pour résoudre
  // l'asset interne. Ça fonctionne en dev comme en prod.
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const buf = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buf }).promise
  const pages: string[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const text = content.items.map((it: any) => ('str' in it ? it.str : '')).join('\n')
    pages.push(text)
  }
  return pages.join('\n')
}

type Props = {
  onClose: () => void
  targetChineuse?: { uid: string; email: string; trigramme: string }
}

type ItemFields = {
  provenance: 'vinted' | 'whatnot' | 'fleek'
  itemId?: string | null
  achatOrderId?: string | null
  titre: string
  titreOriginal?: string
  marque: string
  taille: string
  tailleOriginale?: string
  couleur: string
  etat: string
  description: string
  descriptionOriginale?: string
  vendeur: string
  prixAchat: number | null
  prixSuggere: number | null
  categorie: { label?: string; idsquare?: string } | null
  prixVente: string // saisi par l'admin, requis
  // Spécifique Fleek : un item = un LOT de N pièces.
  quantiteLot?: number
  prixLot?: number
}

type Step = 'paste' | 'preview' | 'creating' | 'done'

export default function ImportMailModal({ onClose, targetChineuse }: Props) {
  const [step, setStep] = useState<Step>('paste')
  const [pasted, setPasted] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [items, setItems] = useState<ItemFields[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [resultMsg, setResultMsg] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [extractingPdf, setExtractingPdf] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Hoisted pour pouvoir être appelée depuis handlePdfFile (auto-trigger après extraction).
  const verifyWithBody = async (body: string) => {
    if (!body.trim()) {
      setErrorMsg('Le PDF est vide ou illisible.')
      return
    }
    setVerifying(true)
    setErrorMsg(null)
    try {
      const user = auth.currentUser
      if (!user) {
        setErrorMsg('Tu n\'es pas connectée.')
        return
      }
      const idToken = await user.getIdToken()
      const res = await fetch('/api/achat/preview-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ body, targetChineuse: targetChineuse || null }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.ok === false) {
        setErrorMsg(json.reason || json.error || `Erreur ${res.status}`)
        return
      }
      const raw: ItemFields[] =
        json.kind === 'whatnot-purchase' || json.kind === 'fleek-invoice'
          ? json.items.map((it: any) => ({ ...it, prixVente: it.prixSuggere ? String(it.prixSuggere) : '' }))
          : [{ ...json.fields, prixVente: json.fields.prixSuggere ? String(json.fields.prixSuggere) : '' }]
      setItems(raw)
      setStep('preview')
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erreur inattendue')
    } finally {
      setVerifying(false)
    }
  }

  const handlePdfFile = async (file: File) => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Le fichier doit être un PDF.')
      return
    }
    setExtractingPdf(true)
    setErrorMsg(null)
    try {
      const text = await extractPdfText(file)
      setPasted(text)
      await verifyWithBody(text)
    } catch (e: any) {
      setErrorMsg(`Lecture PDF impossible : ${e?.message || e}`)
    } finally {
      setExtractingPdf(false)
    }
  }

  const updateItem = (i: number, patch: Partial<ItemFields>) => {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }

  const handleVerify = () => verifyWithBody(pasted)

  const handleCreate = async () => {
    // validation : tous les champs obligatoires doivent être remplis avant création
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const isFleek = it.provenance === 'fleek'
      const prefix = items.length > 1 ? (isFleek ? `Lot ${i + 1} : ` : `Pièce ${i + 1} : `) : ''
      if (!it.titre?.trim()) {
        setErrorMsg(`${prefix}le titre est obligatoire.`)
        return
      }
      if (!it.categorie?.label?.trim()) {
        setErrorMsg(`${prefix}la catégorie est obligatoire (non détectée auto, à compléter à la main après création).`)
        return
      }
      // Pour Fleek : la marque/taille/etc. seront renseignées pièce par pièce
      // après réception (lot générique style "Premium Ralph Lauren Polo Shirts").
      if (!isFleek) {
        if (!it.marque?.trim()) {
          setErrorMsg(`${prefix}la marque est obligatoire.`)
          return
        }
        if (!it.taille?.trim()) {
          setErrorMsg(`${prefix}la taille est obligatoire.`)
          return
        }
      }
      if (isFleek) {
        const qty = Number(it.quantiteLot)
        if (!Number.isFinite(qty) || qty <= 0) {
          setErrorMsg(`${prefix}quantité du lot manquante.`)
          return
        }
      }
      const pv = parseFloat(it.prixVente || '')
      if (!Number.isFinite(pv) || pv <= 0) {
        setErrorMsg(`${prefix}prix de vente manquant ou invalide.`)
        return
      }
    }
    setStep('creating')
    setErrorMsg(null)
    try {
      const user = auth.currentUser
      if (!user) {
        setErrorMsg('Tu n\'es pas connectée.')
        setStep('preview')
        return
      }
      const idToken = await user.getIdToken()
      const res = await fetch('/api/achat/import-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          validatedItems: items,
          targetChineuse: targetChineuse || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.ok === false) {
        setErrorMsg(json.reason || json.error || `Erreur ${res.status}`)
        setStep('preview')
        return
      }
      setResultMsg(`✓ ${items.length} pièce(s) créée(s)`)
      setStep('done')
    } catch (e: any) {
      setErrorMsg(e?.message || 'Erreur inattendue')
      setStep('preview')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto overscroll-contain" onClick={onClose}>
      <div className="min-h-full flex items-start sm:items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl my-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {step === 'preview' ? 'Vérifie avant création' : 'Importer depuis Vinted / Whatnot / Fleek'}
            </h2>
            {step === 'paste' && (
              <p className="text-sm text-gray-500 mt-1">
                Colle ici la page Vinted, le mail Whatnot ou le texte de la facture Fleek.
              </p>
            )}
            {step === 'preview' && (
              <p className="text-sm text-gray-500 mt-1">
                Corrige si besoin et saisis le prix de vente, puis valide.
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {step === 'paste' && (
          <>
            {/* Zone drag&drop / parcourir (Fleek = facture PDF) */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault()
                setIsDragging(false)
                const file = e.dataTransfer.files?.[0]
                if (file) void handlePdfFile(file)
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`mb-3 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-[#F5C842] bg-[#fffbe6]' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
              }`}
            >
              <Upload size={20} className="mx-auto text-gray-400 mb-1" />
              <div className="text-sm text-gray-700">
                {extractingPdf ? 'Lecture du PDF…' : (
                  <>
                    Glisse une facture <strong>Fleek (PDF)</strong> ici, ou{' '}
                    <span className="text-[#09B1BA] underline">parcourir</span>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handlePdfFile(file)
                  e.target.value = ''
                }}
              />
            </div>
            <div className="text-xs text-gray-400 mb-2 text-center">— ou colle le contenu ci-dessous —</div>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder="Colle ici le mail ou la page Vinted/Whatnot…"
              className="flex-1 min-h-[200px] w-full border border-gray-300 rounded-lg p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#09B1BA] resize-none"
            />
            {errorMsg && (
              <div className="mt-3 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
                ✗ {errorMsg}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Fermer</button>
              <button
                onClick={handleVerify}
                disabled={verifying || extractingPdf || !pasted.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[#09B1BA] hover:bg-[#078a91] disabled:opacity-50 rounded-lg"
              >
                {verifying ? 'Vérification…' : 'Vérifier'}
              </button>
            </div>
          </>
        )}

        {step === 'preview' && (
          <>
            <div className="-mx-2 px-2 space-y-4">
              {items.map((it, i) => {
                const isFleek = it.provenance === 'fleek'
                return (
                <div key={i} className="border rounded-xl p-4 bg-gray-50">
                  {items.length > 1 && (
                    <div className="text-xs font-semibold text-[#09B1BA] mb-2">
                      {isFleek ? `Lot ${i + 1}/${items.length}` : `Pièce ${i + 1}/${items.length}`}
                    </div>
                  )}
                  {isFleek && (
                    <div className="mb-3 p-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-semibold">Lot Fleek</span> · {it.quantiteLot ?? '?'} pièces ·
                        <span className="ml-1">prix lot {it.prixLot != null ? `${it.prixLot.toFixed(2)} €` : '—'}</span> ·
                        <span className="ml-1">unitaire {it.prixAchat != null ? `${it.prixAchat.toFixed(2)} €` : '—'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-amber-900">Qté reçue</label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={it.quantiteLot ?? ''}
                          onChange={(e) => updateItem(i, { quantiteLot: parseInt(e.target.value || '0', 10) || 0 })}
                          className="w-16 border border-amber-300 rounded px-2 py-0.5 text-xs bg-white"
                        />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500">{isFleek ? 'Libellé du lot' : 'Titre'}</label>
                      <input value={it.titre} onChange={(e) => updateItem(i, { titre: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Marque {isFleek && <span className="text-gray-400">(facultatif)</span>}</label>
                      <input value={it.marque} onChange={(e) => updateItem(i, { marque: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Taille {isFleek && <span className="text-gray-400">(facultatif)</span>}</label>
                      <input value={it.taille} onChange={(e) => updateItem(i, { taille: e.target.value })} placeholder={it.tailleOriginale ? `orig: ${it.tailleOriginale}` : ''} className="w-full border rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Couleur</label>
                      <input value={it.couleur} onChange={(e) => updateItem(i, { couleur: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">État</label>
                      <input value={it.etat} onChange={(e) => updateItem(i, { etat: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500">Description {it.descriptionOriginale ? '(corrigée)' : ''}</label>
                      <textarea value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} rows={3} className="w-full border rounded px-2 py-1.5 text-sm resize-none" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Catégorie</label>
                      <input value={it.categorie?.label || ''} readOnly className="w-full border rounded px-2 py-1.5 text-sm bg-gray-100" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Prix d'achat unitaire (€)</label>
                      <input value={it.prixAchat != null ? String(it.prixAchat) : ''} readOnly className="w-full border rounded px-2 py-1.5 text-sm bg-gray-100" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 font-semibold">
                        Prix de vente {isFleek ? 'par pièce ' : ''}(€) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.prixVente}
                        onChange={(e) => updateItem(i, { prixVente: e.target.value })}
                        placeholder={it.prixSuggere ? `suggéré : ${it.prixSuggere}` : ''}
                        className="w-full border rounded px-2 py-1.5 text-sm border-[#09B1BA]/40"
                        required
                      />
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
            {errorMsg && (
              <div className="mt-3 px-3 py-2 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
                ✗ {errorMsg}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setStep('paste')} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Retour</button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 text-sm font-medium text-white bg-[#09B1BA] hover:bg-[#078a91] rounded-lg"
              >
                Créer
              </button>
            </div>
          </>
        )}

        {step === 'creating' && (
          <div className="flex-1 flex items-center justify-center text-gray-600">Création en cours…</div>
        )}

        {step === 'done' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="text-green-700 font-medium">{resultMsg}</div>
            <div className="flex gap-2">
              <button onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
                Fermer
              </button>
              <button
                onClick={() => {
                  // reset complet pour enchaîner sur une autre pièce
                  setPasted('')
                  setItems([])
                  setErrorMsg(null)
                  setResultMsg(null)
                  setStep('paste')
                }}
                className="px-4 py-2 bg-[#09B1BA] text-white text-sm rounded-lg hover:bg-[#078a91]"
              >
                Ajouter une autre pièce
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
