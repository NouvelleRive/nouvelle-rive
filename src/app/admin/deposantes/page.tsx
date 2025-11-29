// app/admin/deposants/page.tsx
'use client'

import { useState, useMemo } from 'react'
import { useAdmin } from '@/lib/admin/context'
import { Search, Plus, X, Trash2, Edit2 } from 'lucide-react'
import { getAuth } from 'firebase/auth'

type CategorieItem = {
  label: string
  idsquare: string
}

type CategorieRapportItem = {
  label: string
  idsquare: string
  nom?: string
  email?: string
  trigramme?: string
  siret?: string
  tva?: string
  iban?: string
  bic?: string
  banqueAdresse?: string
  adresse1?: string
  adresse2?: string
}

type Deposante = {
  id: string
  nom?: string
  email?: string
  trigramme?: string
  instagram?: string
  accroche?: string
  description?: string
  specialite?: string
  lien?: string
  imageUrl?: string
  ordre?: number
  displayOnWebsite?: boolean
  slug?: string
  createdAt?: any
  updatedAt?: any
  'Catégorie'?: CategorieItem[]
  'Catégorie de rapport'?: CategorieRapportItem[]
}

const EMPTY_FORM = {
  id: '',
  nom: '',
  trigramme: '',
  email: '',
  instagram: '',
  accroche: '',
  description: '',
  specialite: '',
  lien: '',
  imageUrl: '',
  ordre: 0,
  categories: [] as CategorieItem[],
  categorieRapportLabel: '',
  categorieRapportIdsquare: '',
  siret: '',
  tva: '',
  iban: '',
  bic: '',
  banqueAdresse: '',
  adresse1: '',
  adresse2: '',
}

export default function AdminDeposantesPage() {
  const { selectedChineuse, deposants, produits, loading } = useAdmin()
  const [rechercheDeposante, setRechercheDeposante] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [newCategorieLabel, setNewCategorieLabel] = useState('')
  const [newCategorieIdsquare, setNewCategorieIdsquare] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  const deposantesFiltreesParChineuse = useMemo(() => {
    if (!selectedChineuse) return deposants
    return deposants.filter((d: any) => d.id === selectedChineuse.uid || d.email === selectedChineuse.email)
  }, [deposants, selectedChineuse])

  const deposantesFiltrees = deposantesFiltreesParChineuse.filter((d: any) => {
    if (!rechercheDeposante) return true
    return [d.email, d.nom, d.trigramme].filter(Boolean).join(' ').toLowerCase().includes(rechercheDeposante.toLowerCase())
  })

  const openCreateModal = () => {
    setFormData(EMPTY_FORM)
    setImageFile(null)
    setImagePreview(null)
    setShowModal(true)
  }

  const openEditModal = (d: Deposante) => {
    const cats = d['Catégorie'] || []
    const catRapport = (d['Catégorie de rapport'] || [])[0] || {}

    setFormData({
      id: d.id,
      nom: d.nom || '',
      trigramme: d.trigramme || '',
      email: d.email || '',
      instagram: d.instagram || '',
      accroche: d.accroche || '',
      description: d.description || '',
      specialite: d.specialite || '',
      lien: d.lien || '',
      imageUrl: d.imageUrl || '',
      ordre: d.ordre || 0,
      categories: cats,
      categorieRapportLabel: catRapport.label || '',
      categorieRapportIdsquare: catRapport.idsquare || '',
      siret: catRapport.siret || '',
      tva: catRapport.tva || '',
      iban: catRapport.iban || '',
      bic: catRapport.bic || '',
      banqueAdresse: catRapport.banqueAdresse || '',
      adresse1: catRapport.adresse1 || '',
      adresse2: catRapport.adresse2 || '',
    })
    setImageFile(null)
    setImagePreview(d.imageUrl || null)
    setShowModal(true)
  }

  const uploadToCloudinary = async (file: File): Promise<string> => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

    if (!cloudName || !uploadPreset) {
      throw new Error('Configuration Cloudinary manquante')
    }

    const fd = new FormData()
    fd.append('file', file)
    fd.append('upload_preset', uploadPreset)
    fd.append('folder', 'deposantes')

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: fd,
    })

    if (!response.ok) throw new Error('Erreur upload')
    const data = await response.json()
    return data.secure_url
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const addCategorie = () => {
    if (!newCategorieLabel.trim()) return
    if (formData.categories.some(c => c.label === newCategorieLabel.trim())) return
    setFormData({
      ...formData,
      categories: [...formData.categories, { label: newCategorieLabel.trim(), idsquare: newCategorieIdsquare.trim() }]
    })
    setNewCategorieLabel('')
    setNewCategorieIdsquare('')
  }

  const removeCategorie = (label: string) => {
    setFormData({ ...formData, categories: formData.categories.filter((c) => c.label !== label) })
  }

  const updateCategorieIdsquare = (label: string, idsquare: string) => {
    setFormData({
      ...formData,
      categories: formData.categories.map(c => c.label === label ? { ...c, idsquare } : c)
    })
  }

  const handleSave = async () => {
    if (!formData.nom.trim()) {
      alert('Le nom est obligatoire')
      return
    }
    if (!formData.trigramme.trim()) {
      alert('Le trigramme est obligatoire')
      return
    }

    setSaving(true)
    try {
      let finalImageUrl = formData.imageUrl

      if (imageFile) {
        finalImageUrl = await uploadToCloudinary(imageFile)
      }

      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()

      const payload = {
        id: formData.id || undefined,
        nom: formData.nom.trim(),
        trigramme: formData.trigramme.trim().toUpperCase(),
        email: formData.email.trim(),
        instagram: formData.instagram.trim(),
        accroche: formData.accroche.trim(),
        description: formData.description.trim(),
        specialite: formData.specialite.trim(),
        lien: formData.lien.trim(),
        imageUrl: finalImageUrl,
        ordre: formData.ordre,
        categories: formData.categories,
        categorieRapport: {
          label: formData.categorieRapportLabel.trim(),
          idsquare: formData.categorieRapportIdsquare.trim(),
          nom: formData.nom.trim(),
          emailCompta: formData.email.trim(),
          siret: formData.siret.trim(),
          tva: formData.tva.trim(),
          iban: formData.iban.trim(),
          bic: formData.bic.trim(),
          banqueAdresse: formData.banqueAdresse.trim(),
          adresse1: formData.adresse1.trim(),
          adresse2: formData.adresse2.trim(),
        },
      }

      const res = await fetch('/api/deposantes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur')
      }

      alert(`✅ Déposante ${data.action === 'created' ? 'créée' : 'mise à jour'} !`)
      setShowModal(false)
      window.location.reload()

    } catch (err: any) {
      alert('❌ Erreur : ' + (err?.message || ''))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, nom: string) => {
    if (!confirm(`Supprimer la déposante "${nom}" ?`)) return

    try {
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()

      const res = await fetch('/api/deposantes', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erreur')
      }

      alert('✅ Déposante supprimée')
      window.location.reload()

    } catch (err: any) {
      alert('❌ Erreur : ' + (err?.message || ''))
    }
  }

  // Helper pour afficher si un champ est vide
  const fieldStatus = (value: string | undefined) => {
    if (!value || value.trim() === '') {
      return <span className="text-red-400 text-xs ml-1">⚠️ vide</span>
    }
    return <span className="text-green-500 text-xs ml-1">✓</span>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-4 mb-4">
        {!selectedChineuse && (
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={rechercheDeposante}
              onChange={(e) => setRechercheDeposante(e.target.value)}
              placeholder="Rechercher..."
              className="w-full pl-10 pr-4 py-2 border rounded text-sm"
            />
          </div>
        )}
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-[#22209C] text-white rounded hover:opacity-90"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Ajouter</span>
        </button>
      </div>

      <div className="space-y-4">
        {deposantesFiltrees.map((d: any) => {
          const rawCats = d?.['Catégorie'] ?? []
          const cats = Array.isArray(rawCats) ? rawCats.map((c: any) => c?.label || '').filter(Boolean) : []
          const nbProduits = produits.filter((p) => p.chineur === d.email || p.chineurUid === d.id).length
          const nbVendues = produits.filter((p) => (p.chineur === d.email || p.chineurUid === d.id) && p.vendu).length
          const caTotal = produits.filter((p) => (p.chineur === d.email || p.chineurUid === d.id) && p.vendu).reduce((sum, p) => sum + (p.prixVenteReel ?? p.prix ?? 0), 0)

          const accroche = d?.accroche || ''
          const description = d?.description || ''
          
          // Compter les champs manquants
          const catRapport = (d['Catégorie de rapport'] || [])[0] || {}
          const champsManquants = [
            !d.email,
            !d.instagram,
            !d.accroche,
            !d.description,
            !d.specialite,
            !d.lien,
            !d.imageUrl,
            !catRapport.siret,
            !catRapport.iban,
          ].filter(Boolean).length

          return (
            <div key={d.id} className="bg-white border rounded-lg overflow-hidden">
              <div className="p-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  {d.imageUrl ? (
                    <img src={d.imageUrl} alt={d.nom} className="w-14 h-14 rounded-lg object-cover" />
                  ) : (
                    <div className="w-14 h-14 bg-[#22209C] text-white rounded-lg flex items-center justify-center font-bold text-lg flex-shrink-0">
                      {d.trigramme || '?'}
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-lg">{(d.nom || '').toUpperCase()}</p>
                      {champsManquants > 0 && (
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                          {champsManquants} champ{champsManquants > 1 ? 's' : ''} manquant{champsManquants > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{d.email || '—'}</p>
                    {accroche && <p className="text-sm text-[#22209C] font-medium mt-1 italic">"{accroche}"</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden md:flex items-center gap-4 text-sm mr-4">
                    <div className="text-center px-3 py-2 bg-gray-50 rounded-lg">
                      <p className="text-gray-500 text-xs">Produits</p>
                      <p className="font-bold text-lg">{nbProduits}</p>
                    </div>
                    <div className="text-center px-3 py-2 bg-green-50 rounded-lg">
                      <p className="text-gray-500 text-xs">Ventes</p>
                      <p className="font-bold text-lg text-green-600">{nbVendues}</p>
                    </div>
                    <div className="text-center px-3 py-2 bg-blue-50 rounded-lg">
                      <p className="text-gray-500 text-xs">CA</p>
                      <p className="font-bold text-lg text-[#22209C]">{caTotal.toFixed(0)} €</p>
                    </div>
                  </div>

                  <button onClick={() => openEditModal(d)} className="p-2 text-gray-500 hover:text-[#22209C]" title="Modifier">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(d.id, d.nom)} className="p-2 text-red-400 hover:text-red-600" title="Supprimer">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {description && (
                <div className="px-4 pb-3">
                  <p className="text-sm text-gray-600 line-clamp-2">{description}</p>
                </div>
              )}

              {cats.length > 0 && (
                <div className="px-4 pb-4">
                  <p className="text-xs text-gray-400 mb-2">Catégories</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cats.map((cat: string, idx: number) => (
                      <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">{cat}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {!deposantesFiltrees.length && <p className="text-center text-gray-400 py-8">Aucune déposante</p>}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold">{formData.id ? 'Modifier la' : 'Nouvelle'} déposante</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* INFOS GÉNÉRALES */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Informations générales</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Nom * {fieldStatus(formData.nom)}
                    </label>
                    <input
                      type="text"
                      value={formData.nom}
                      onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                      placeholder="Ines Pineau"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Trigramme * {fieldStatus(formData.trigramme)}
                    </label>
                    <input
                      type="text"
                      value={formData.trigramme}
                      onChange={(e) => setFormData({ ...formData, trigramme: e.target.value.toUpperCase() })}
                      placeholder="IP"
                      maxLength={4}
                      className="w-full border rounded px-3 py-2 uppercase"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Email {fieldStatus(formData.email)}
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="contact@example.com"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Instagram {fieldStatus(formData.instagram)}
                    </label>
                    <input
                      type="url"
                      value={formData.instagram}
                      onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                      placeholder="https://instagram.com/..."
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium mb-1">
                    Accroche {fieldStatus(formData.accroche)}
                  </label>
                  <input
                    type="text"
                    value={formData.accroche}
                    onChange={(e) => setFormData({ ...formData, accroche: e.target.value })}
                    placeholder="BIJOUX UPCYCLÉS FAITS MAIN À PARIS"
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium mb-1">
                    Description {fieldStatus(formData.description)}
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Présentation de la marque..."
                    rows={3}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Spécialité {fieldStatus(formData.specialite)}
                    </label>
                    <input
                      type="text"
                      value={formData.specialite}
                      onChange={(e) => setFormData({ ...formData, specialite: e.target.value })}
                      placeholder="Bijoux upcyclés"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Site web {fieldStatus(formData.lien)}
                    </label>
                    <input
                      type="url"
                      value={formData.lien}
                      onChange={(e) => setFormData({ ...formData, lien: e.target.value })}
                      placeholder="https://..."
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Photo {fieldStatus(formData.imageUrl)}
                    </label>
                    <div className="flex items-center gap-4">
                      {imagePreview && (
                        <img src={imagePreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
                      )}
                      <label className="flex-1 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:bg-gray-50">
                        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                        <p className="text-xs text-gray-500">Cliquez pour ajouter</p>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Ordre d'affichage</label>
                    <input
                      type="number"
                      value={formData.ordre}
                      onChange={(e) => setFormData({ ...formData, ordre: parseInt(e.target.value) || 0 })}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>
              </div>

              {/* CATÉGORIES */}
              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                  Catégories produits 
                  {formData.categories.length === 0 && <span className="text-red-400 text-xs ml-1">⚠️ aucune</span>}
                  {formData.categories.length > 0 && <span className="text-green-500 text-xs ml-1">✓ {formData.categories.length}</span>}
                </h3>
                
                <div className="space-y-2 mb-4">
                  {formData.categories.map((cat, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                      <span className="flex-1 text-sm font-medium">{cat.label}</span>
                      <input
                        type="text"
                        value={cat.idsquare}
                        onChange={(e) => updateCategorieIdsquare(cat.label, e.target.value)}
                        placeholder="ID Square"
                        className={`w-48 border rounded px-2 py-1 text-xs font-mono ${!cat.idsquare ? 'border-orange-300 bg-orange-50' : ''}`}
                      />
                      {!cat.idsquare && <span className="text-orange-400 text-xs">⚠️</span>}
                      {cat.idsquare && <span className="text-green-500 text-xs">✓</span>}
                      <button onClick={() => removeCategorie(cat.label)} className="p-1 text-red-400 hover:text-red-600">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategorieLabel}
                    onChange={(e) => setNewCategorieLabel(e.target.value)}
                    placeholder="IP - Nouvelle catégorie"
                    className="flex-1 border rounded px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    value={newCategorieIdsquare}
                    onChange={(e) => setNewCategorieIdsquare(e.target.value)}
                    placeholder="ID Square"
                    className="w-48 border rounded px-3 py-2 text-sm font-mono"
                  />
                  <button onClick={addCategorie} className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200">
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              {/* CATÉGORIE DE RAPPORT (SQUARE) */}
              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                  Catégorie de rapport (Square)
                  {fieldStatus(formData.categorieRapportLabel)}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Label</label>
                    <input
                      type="text"
                      value={formData.categorieRapportLabel}
                      onChange={(e) => setFormData({ ...formData, categorieRapportLabel: e.target.value })}
                      placeholder="INES PINEAU"
                      className={`w-full border rounded px-3 py-2 text-sm ${!formData.categorieRapportLabel ? 'border-orange-300 bg-orange-50' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">ID Square</label>
                    <input
                      type="text"
                      value={formData.categorieRapportIdsquare}
                      onChange={(e) => setFormData({ ...formData, categorieRapportIdsquare: e.target.value })}
                      placeholder="77ST6DK45WNHD6KVH2OTGX5O"
                      className={`w-full border rounded px-3 py-2 text-sm font-mono ${!formData.categorieRapportIdsquare ? 'border-orange-300 bg-orange-50' : ''}`}
                    />
                  </div>
                </div>
              </div>

              {/* INFOS COMPTABLES */}
              <div className="border-t pt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Informations comptables</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      SIRET {fieldStatus(formData.siret)}
                    </label>
                    <input
                      type="text"
                      value={formData.siret}
                      onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                      placeholder="123 456 789 00012"
                      className={`w-full border rounded px-3 py-2 text-sm ${!formData.siret ? 'border-orange-300 bg-orange-50' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      N° TVA {fieldStatus(formData.tva)}
                    </label>
                    <input
                      type="text"
                      value={formData.tva}
                      onChange={(e) => setFormData({ ...formData, tva: e.target.value })}
                      placeholder="FR12345678901"
                      className={`w-full border rounded px-3 py-2 text-sm ${!formData.tva ? 'border-orange-300 bg-orange-50' : ''}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      IBAN {fieldStatus(formData.iban)}
                    </label>
                    <input
                      type="text"
                      value={formData.iban}
                      onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                      placeholder="FR76 1234 5678 9012 3456 7890 123"
                      className={`w-full border rounded px-3 py-2 text-sm font-mono ${!formData.iban ? 'border-orange-300 bg-orange-50' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      BIC {fieldStatus(formData.bic)}
                    </label>
                    <input
                      type="text"
                      value={formData.bic}
                      onChange={(e) => setFormData({ ...formData, bic: e.target.value })}
                      placeholder="BNPAFRPP"
                      className={`w-full border rounded px-3 py-2 text-sm font-mono ${!formData.bic ? 'border-orange-300 bg-orange-50' : ''}`}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-xs text-gray-500 mb-1">
                    Adresse banque {fieldStatus(formData.banqueAdresse)}
                  </label>
                  <input
                    type="text"
                    value={formData.banqueAdresse}
                    onChange={(e) => setFormData({ ...formData, banqueAdresse: e.target.value })}
                    placeholder="BNP Paribas - 16 Boulevard des Italiens, 75009 Paris"
                    className={`w-full border rounded px-3 py-2 text-sm ${!formData.banqueAdresse ? 'border-orange-300 bg-orange-50' : ''}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Adresse ligne 1 {fieldStatus(formData.adresse1)}
                    </label>
                    <input
                      type="text"
                      value={formData.adresse1}
                      onChange={(e) => setFormData({ ...formData, adresse1: e.target.value })}
                      placeholder="123 Rue de la Paix"
                      className={`w-full border rounded px-3 py-2 text-sm ${!formData.adresse1 ? 'border-orange-300 bg-orange-50' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Adresse ligne 2 {fieldStatus(formData.adresse2)}
                    </label>
                    <input
                      type="text"
                      value={formData.adresse2}
                      onChange={(e) => setFormData({ ...formData, adresse2: e.target.value })}
                      placeholder="75002 Paris"
                      className={`w-full border rounded px-3 py-2 text-sm ${!formData.adresse2 ? 'border-orange-300 bg-orange-50' : ''}`}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded hover:bg-gray-50">
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-[#22209C] text-white rounded hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : formData.id ? 'Mettre à jour' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}