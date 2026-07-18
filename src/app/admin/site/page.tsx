// app/admin/site/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { doc, getDoc, setDoc, collection, getDocs, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { useFilteredProducts } from '@/lib/siteConfig'
import { Save, Plus, X, Trash2 } from 'lucide-react'
import { Eye, EyeOff, GripVertical, ArrowUp, ArrowDown, Heart } from 'lucide-react'
import ProductList, { Produit } from '@/components/ProductList'
import IconiquesManager from '@/components/admin/IconiquesManager'
import NavManager from '@/components/admin/NavManager'
import { getConfigurablePages } from '@/lib/site-pages'
import type { NavPage } from '@/lib/nav-config'

type Critere = {
  type: 'categorie' | 'nom' | 'description' | 'marque' | 'chineuse'
  valeur: string
}

type Regle = {
  id: string
  criteres: Critere[]
}

type PageConfig = {
  regles: Regle[]
  prixMin?: number
  prixMax?: number
  joursRecents?: number
  produitsManquels?: string[]
  ordreManuel?: string[]
}

type Chineuse = {
  id: string
  nom?: string
  email?: string
  trigramme?: string
}

type ProduitPreview = {
  id: string
  nom: string
  imageUrl?: string
  imageUrls?: string[]
  prix?: number
  nbFavoris?: number
  masque?: boolean
}

// Fallback statique utilisé le temps que NavManager charge `siteConfig/_nav`.
// Une fois chargé, le dropdown est alimenté par les pages du NavManager.
const FALLBACK_PAGES = getConfigurablePages().map(p => ({
  id: p.id,
  label: p.labelAdmin || p.id,
  inNav: !!p.inNav,
}))

const ICONIQUE_PAGE_IDS = ['iconiques-vintage', 'iconiques-upcy'] as const

const CATEGORIES = [
  'Ensemble', 'Haut', 'Pantalon', 'Robe', 'Jupe / Short', 'Veste / Manteau',
  'Chaussures', 'Pull / Gilet', 'Sac', 'Ceinture', 'Combinaison', 'Bracelet',
  'Boucles d\'oreilles', 'Collier', 'Bague', 'Broches', 'Accessoires',
  'Earcuff', 'Charms', 'Piercing', 'Porte clef', 'Porte briquet', 'Lunettes',
]

const TYPES_CRITERES = [
  { value: 'categorie', label: 'Catégorie' },
  { value: 'nom', label: 'Nom contient' },
  { value: 'description', label: 'Description contient' },
  { value: 'marque', label: 'Marque' },
  { value: 'chineuse', label: 'Chineuse' },
]

const DEFAULT_CONFIG: PageConfig = {
  regles: [],
}

function generateId() {
  return Math.random().toString(36).substr(2, 9)
}

export default function AdminSitePage() {
  const [navPages, setNavPages] = useState<NavPage[]>([])
  const [selectedPage, setSelectedPage] = useState(FALLBACK_PAGES[0].id)
  // Dropdown "Page à configurer" : on liste TOUTES les pages du NavManager (pas seulement
  // celles marquées `configurable`), pour que ce qui est édité en haut soit sélectionnable
  // en bas. Les pages non-configurables (statiques comme /nos-creatrices) sont sélectionnables
  // mais le formulaire de règles affichera un message qu'elles n'ont pas de matching.
  const configurablePages = (navPages.length > 0
    ? navPages.map(p => ({ id: p.id, label: p.labelFr, inNav: !p.hidden, configurable: p.configurable }))
    : FALLBACK_PAGES.map(p => ({ ...p, configurable: true })))
  const selectedPageMeta = configurablePages.find(p => p.id === selectedPage)
  const isPageConfigurable = selectedPageMeta?.configurable !== false
  const [config, setConfig] = useState<PageConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [chineusesList, setChineusesList] = useState<Chineuse[]>([])

  const [produitsFiltrés, setProduitsFiltrés] = useState<ProduitPreview[]>([])
  const [loadingProduits, setLoadingProduits] = useState(false)
  const isIconiquesMode = ICONIQUE_PAGE_IDS.includes(selectedPage as any)
  const { produits: produitsFromHook, loading: loadingProduitsHook } = useFilteredProducts(selectedPage, { skip: isIconiquesMode })
  const [localProduits, setLocalProduits] = useState<Produit[]>([])

  // Sync local products with hook.
  // /api/page-produits sérialise createdAt/dateVente en millis, mais les autres
  // Timestamps (dateReception, prixBaisseLe…) sortent en {_seconds,_nanoseconds}
  // via JSON.stringify du Firestore Admin SDK. ProductList appelle .toDate()
  // partout : on reconvertit tout en Timestamp SDK client.
  useEffect(() => {
    const reTs = (v: any) => {
      if (!v) return v
      if (v instanceof Timestamp) return v
      if (typeof v === 'number' && v > 0) return Timestamp.fromMillis(v)
      if (typeof v === 'object') {
        const s = v._seconds ?? v.seconds
        const n = v._nanoseconds ?? v.nanoseconds ?? 0
        if (typeof s === 'number') return new Timestamp(s, n)
      }
      return v
    }
    const converted = (produitsFromHook as any[]).map(p => ({
      ...p,
      createdAt: reTs(p.createdAt),
      dateVente: reTs(p.dateVente),
      dateReception: reTs(p.dateReception),
      dateRetour: reTs(p.dateRetour),
      prixBaisseLe: reTs(p.prixBaisseLe),
      achatDateLivraison: reTs(p.achatDateLivraison),
    })) as Produit[]
    setLocalProduits(converted)
  }, [produitsFromHook])

  // Callback pour mise à jour immédiate après modification
  const handleProductUpdated = useCallback((productId: string, updatedData: Partial<Produit>) => {
    setLocalProduits(prev => prev.map(p =>
      p.id === productId ? { ...p, ...updatedData } : p
    ))
  }, [])

  useEffect(() => {
    async function fetchChineuses() {
      try {
        const snap = await getDocs(collection(db, 'chineuse'))
        const data = snap.docs.map(d => ({
          id: d.id,
          nom: d.data().nom,
          email: d.data().email,
          trigramme: d.data().trigramme,
        }))
        setChineusesList(data)
      } catch (error) {
        console.error('Erreur chargement chineuses:', error)
      }
    }
    fetchChineuses()
  }, [])

  useEffect(() => {
    if (ICONIQUE_PAGE_IDS.includes(selectedPage as any)) {
      setLoading(false)
      return
    }
    async function fetchConfig() {
      setLoading(true)
      try {
        const docRef = doc(db, 'siteConfig', selectedPage)
        const docSnap = await getDoc(docRef)
        
        if (docSnap.exists()) {
          const data = docSnap.data()
          if (data.regles) {
            setConfig(data as PageConfig)
          } else {
            setConfig(DEFAULT_CONFIG)
          }
        } else {
          setConfig(DEFAULT_CONFIG)
        }
      } catch (error) {
        console.error('Erreur:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchConfig()
  }, [selectedPage])

  const handleSave = async () => {
    setSaving(true)
    try {
      await setDoc(doc(db, 'siteConfig', selectedPage), {
        ...config,
        updatedAt: new Date()
      })
      // Invalide le cache serveur (unstable_cache tag + edge cache /api/page-produits)
      // → la page publique reflète les nouvelles règles immédiatement.
      try {
        await fetch('/api/site-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId: selectedPage }),
        })
      } catch {
        /* la save Firestore est OK, si l'invalidation échoue le TTL 6h finira le job */
      }
      alert('✅ Sauvegardé !')
    } catch (error) {
      console.error('Erreur:', error)
      alert('❌ Erreur de sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const addRegle = () => {
    setConfig({
      ...config,
      regles: [...config.regles, { id: generateId(), criteres: [] }]
    })
  }

  const removeRegle = (regleId: string) => {
    setConfig({
      ...config,
      regles: config.regles.filter(r => r.id !== regleId)
    })
  }

  const addCritere = (regleId: string) => {
    setConfig({
      ...config,
      regles: config.regles.map(r => {
        if (r.id !== regleId) return r
        return {
          ...r,
          criteres: [...r.criteres, { type: 'categorie', valeur: '' }]
        }
      })
    })
  }

  const updateCritere = (regleId: string, critereIndex: number, field: 'type' | 'valeur', value: string) => {
    setConfig({
      ...config,
      regles: config.regles.map(r => {
        if (r.id !== regleId) return r
        const newCriteres = [...r.criteres]
        if (field === 'type') {
          newCriteres[critereIndex] = { type: value as Critere['type'], valeur: '' }
        } else {
          newCriteres[critereIndex] = { ...newCriteres[critereIndex], valeur: value }
        }
        return { ...r, criteres: newCriteres }
      })
    })
  }

  const removeCritere = (regleId: string, critereIndex: number) => {
    setConfig({
      ...config,
      regles: config.regles.map(r => {
        if (r.id !== regleId) return r
        return {
          ...r,
          criteres: r.criteres.filter((_, i) => i !== critereIndex)
        }
      })
    })
  }

  const formatRegle = (regle: Regle) => {
    if (regle.criteres.length === 0) return '(vide)'
    return regle.criteres.map(c => {
      const typeLabel = TYPES_CRITERES.find(t => t.value === c.type)?.label || c.type
      if (c.type === 'chineuse') {
        const chineuse = chineusesList.find(ch => ch.id === c.valeur)
        return `${typeLabel} = "${chineuse?.nom || c.valeur}"`
      }
      return `${typeLabel} = "${c.valeur}"`
    }).join(' ET ')
  }

  const toggleMasquerProduit = (produitId: string) => {
  const current = config.produitsManquels || []
  const newList = current.includes(produitId)
    ? current.filter(id => id !== produitId)
    : [...current, produitId]
  setConfig({ ...config, produitsManquels: newList })
}

const moveProduct = (produitId: string, direction: 'up' | 'down') => {
  const currentOrder = config.ordreManuel || produitsFiltrés.map(p => p.id)
  const index = currentOrder.indexOf(produitId)
  if (index === -1) return
  
  const newIndex = direction === 'up' ? index - 1 : index + 1
  if (newIndex < 0 || newIndex >= currentOrder.length) return
  
  const newOrder = [...currentOrder]
  ;[newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]]
  setConfig({ ...config, ordreManuel: newOrder })
  
  // Mettre à jour l'affichage local
  const newProduits = [...produitsFiltrés]
  ;[newProduits[index], newProduits[newIndex]] = [newProduits[newIndex], newProduits[index]]
  setProduitsFiltrés(newProduits)
}

const resetOrdre = () => {
  setConfig({ ...config, ordreManuel: undefined })
  const sorted = [...produitsFiltrés].sort((a, b) => (b.nbFavoris || 0) - (a.nbFavoris || 0))
  setProduitsFiltrés(sorted)
}

const getImageUrl = (p: ProduitPreview) => {
  if (p.imageUrls && p.imageUrls.length > 0) return p.imageUrls[0]
  return p.imageUrl || ''
}

  return (
    <div className="space-y-6">
      <NavManager onPagesChange={setNavPages} />

      <h1 className="text-xl font-bold text-[#22209C]">Configuration des pages</h1>

      <div>
        <label className="block text-sm font-medium mb-2">Page à configurer</label>
        {/* key sur le <select> qui inclut la concat des labels : Chrome ne rafraîchit pas
            le texte natif des <option> quand seules leurs props changent, on force donc
            un remount complet du select quand un label du NavManager du dessus change. */}
        <select
          key={configurablePages.map(p => `${p.id}:${p.label}:${p.inNav ? 1 : 0}`).join('|')}
          value={selectedPage}
          onChange={(e) => setSelectedPage(e.target.value)}
          className="border rounded px-3 py-2 w-full max-w-xs"
        >
          {configurablePages.map((p) => (
            <option key={`${p.id}-${p.label}`} value={p.id}>
              {p.inNav ? '🔗 ' : ''}{p.label}
            </option>
          ))}
        </select>
      </div>

      {ICONIQUE_PAGE_IDS.includes(selectedPage as any) ? (
        <IconiquesManager typeFilter={selectedPage === 'iconiques-vintage' ? 'vintage' : 'upcy'} />
      ) : !isPageConfigurable ? (
        <div className="bg-white border rounded-lg p-6 text-sm text-gray-600">
          Cette page n'a pas de règles de matching à configurer (contenu géré directement en code).
        </div>
      ) : loading ? (
        <div className="py-10 text-center text-gray-500">Chargement...</div>
      ) : (
        <div className="bg-white border rounded-lg p-6 space-y-6">

          {config.regles.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-3">📋 Règles actives (liées par OU) :</h3>
              <div className="space-y-2">
                {config.regles.map((regle, idx) => (
                  <div key={regle.id} className="flex items-center gap-2">
                    <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded">
                      Règle {idx + 1}
                    </span>
                    <span className="text-sm text-blue-700">{formatRegle(regle)}</span>
                  </div>
                ))}
              </div>
              {(config.prixMin || config.prixMax || config.joursRecents) && (
                <div className="mt-3 pt-3 border-t border-blue-200 text-sm text-blue-700">
                  <span className="font-medium">+ Filtres globaux : </span>
                  {config.prixMin && `Prix min ${config.prixMin}€ `}
                  {config.prixMax && `Prix max ${config.prixMax}€ `}
                  {config.joursRecents && `Derniers ${config.joursRecents} jours`}
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Règles de filtrage</h3>
            <p className="text-xs text-gray-500">
              Un produit s'affiche s'il correspond à <strong>au moins une règle</strong> (OU).
              <br />
              Dans chaque règle, <strong>tous les critères</strong> doivent être remplis (ET).
            </p>

            {config.regles.map((regle, regleIndex) => (
              <div key={regle.id} className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-sm">Règle {regleIndex + 1}</span>
                  <button
                    onClick={() => removeRegle(regle.id)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Supprimer la règle"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="space-y-2">
                  {regle.criteres.map((critere, critereIndex) => (
                    <div key={critereIndex} className="flex items-center gap-2 flex-wrap">
                      {critereIndex > 0 && (
                        <span className="text-xs text-gray-500 font-medium">ET</span>
                      )}
                      
                      <select
                        value={critere.type}
                        onChange={(e) => updateCritere(regle.id, critereIndex, 'type', e.target.value)}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        {TYPES_CRITERES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>

                      <span className="text-gray-400">=</span>

                      {critere.type === 'categorie' ? (
                        <select
                          value={critere.valeur}
                          onChange={(e) => updateCritere(regle.id, critereIndex, 'valeur', e.target.value)}
                          className="border rounded px-2 py-1 text-sm flex-1 min-w-[150px]"
                        >
                          <option value="">Choisir...</option>
                          {CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      ) : critere.type === 'chineuse' ? (
                        <select
                          value={critere.valeur}
                          onChange={(e) => updateCritere(regle.id, critereIndex, 'valeur', e.target.value)}
                          className="border rounded px-2 py-1 text-sm flex-1 min-w-[150px]"
                        >
                          <option value="">Choisir...</option>
                          {chineusesList.map(c => (
                            <option key={c.id} value={c.id}>{c.nom || c.email || c.id}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={critere.valeur}
                          onChange={(e) => updateCritere(regle.id, critereIndex, 'valeur', e.target.value)}
                          placeholder="Valeur..."
                          className="border rounded px-2 py-1 text-sm flex-1 min-w-[150px]"
                        />
                      )}

                      <button
                        onClick={() => removeCritere(regle.id, critereIndex)}
                        className="text-gray-400 hover:text-red-500 p-1"
                        title="Supprimer ce critère"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => addCritere(regle.id)}
                  className="mt-3 text-sm text-[#22209C] hover:underline flex items-center gap-1"
                >
                  <Plus size={14} /> Ajouter un critère
                </button>
              </div>
            ))}

            <button
              onClick={addRegle}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-[#22209C] hover:text-[#22209C] transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={18} /> Ajouter une règle
            </button>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Filtres globaux (appliqués en plus des règles)</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Prix min (€)</label>
                <input
                  type="number"
                  value={config.prixMin || ''}
                  onChange={(e) => setConfig({ ...config, prixMin: e.target.value ? Number(e.target.value) : undefined })}
                  className="border rounded px-3 py-2 w-full"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Prix max (€)</label>
                <input
                  type="number"
                  value={config.prixMax || ''}
                  onChange={(e) => setConfig({ ...config, prixMax: e.target.value ? Number(e.target.value) : undefined })}
                  className="border rounded px-3 py-2 w-full"
                  placeholder="∞"
                />
              </div>
            </div>

            {selectedPage === 'new-in' && (
              <div className="mt-4">
                <label className="block text-sm font-medium mb-1">Produits des X derniers jours</label>
                <input
                  type="number"
                  value={config.joursRecents || ''}
                  onChange={(e) => setConfig({ ...config, joursRecents: e.target.value ? Number(e.target.value) : undefined })}
                  className="border rounded px-3 py-2 w-48"
                  placeholder="30"
                />
              </div>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-[#22209C] text-white px-6 py-2.5 rounded font-medium hover:opacity-90 disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      )}
      <div className="border-t pt-6 mt-6">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-sm font-semibold text-gray-700">
      Produits correspondants ({produitsFromHook.length} total)
    </h3>
  </div>
  
  {loadingProduitsHook ? (
    <div className="py-10 text-center text-gray-500">Chargement des produits...</div>
  ) : (
    <ProductList
      titre=""
      produits={localProduits}
      isAdmin={true}
      loading={loadingProduitsHook}
      onProductUpdated={handleProductUpdated}
      customDeleteTitle="Retirer de cette page (le produit reste publié)"
      onCustomDelete={(id) => {
        // Retire de la vue locale (UX immédiate)
        setLocalProduits(prev => prev.filter(p => p.id !== id))
        // Ajoute aux exclus de la config (sauvegardé via le bouton 'Enregistrer')
        const current = config.produitsManquels || []
        if (!current.includes(id)) {
          setConfig({ ...config, produitsManquels: [...current, id] })
        }
      }}
    />
  )}
</div>
      </div>
  )
}