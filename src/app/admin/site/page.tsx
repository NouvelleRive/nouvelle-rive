// app/admin/site/page.tsx
'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { Save, Plus, X } from 'lucide-react'

type PageConfig = {
  chineuses: string[]
  categoriesContient: string[]
  nomContient: string[]
  descriptionContient: string[]
  marques: string[]
  prixMin?: number
  prixMax?: number
  joursRecents?: number
}

const PAGES = [
  { id: 'new-in', label: 'New In' },
  { id: 'hiver', label: 'Hiver' },
  { id: 'soiree', label: 'Soirée' },
  { id: 'luxe', label: 'Le Luxe' },
  { id: 'femme', label: '(Plutôt) Femme' },
  { id: 'homme', label: '(Plutôt) Homme' },
  { id: 'enfant', label: 'Enfant' },
  { id: 'accessoires', label: 'Accessoires' },
]

const DEFAULT_CONFIG: PageConfig = {
  chineuses: [],
  categoriesContient: [],
  nomContient: [],
  descriptionContient: [],
  marques: [],
}

export default function AdminSitePage() {
  const [selectedPage, setSelectedPage] = useState(PAGES[0].id)
  const [config, setConfig] = useState<PageConfig>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Charger la config quand on change de page
  useEffect(() => {
    async function fetchConfig() {
      setLoading(true)
      try {
        const docRef = doc(db, 'siteConfig', selectedPage)
        const docSnap = await getDoc(docRef)
        
        if (docSnap.exists()) {
          setConfig({ ...DEFAULT_CONFIG, ...docSnap.data() } as PageConfig)
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

  // Sauvegarder
  const handleSave = async () => {
    setSaving(true)
    try {
      await setDoc(doc(db, 'siteConfig', selectedPage), {
        ...config,
        updatedAt: new Date()
      })
      alert('✅ Sauvegardé !')
    } catch (error) {
      console.error('Erreur:', error)
      alert('❌ Erreur')
    } finally {
      setSaving(false)
    }
  }

  // Ajouter à un tableau
  const addToArray = (key: keyof PageConfig, value: string) => {
    if (!value.trim()) return
    const arr = config[key] as string[]
    if (arr.includes(value)) return
    setConfig({ ...config, [key]: [...arr, value] })
  }

  // Supprimer d'un tableau
  const removeFromArray = (key: keyof PageConfig, value: string) => {
    const arr = config[key] as string[]
    setConfig({ ...config, [key]: arr.filter(v => v !== value) })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-[#22209C]">Configuration des pages</h1>

      {/* Sélecteur de page */}
      <div>
        <label className="block text-sm font-medium mb-2">Page à configurer</label>
        <select
          value={selectedPage}
          onChange={(e) => setSelectedPage(e.target.value)}
          className="border rounded px-3 py-2 w-full max-w-xs"
        >
          {PAGES.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="py-10 text-center text-gray-500">Chargement...</div>
      ) : (
        <div className="bg-white border rounded-lg p-6 space-y-6">
          
          {/* Chineuses */}
          <FieldArray
            label="Chineuses"
            values={config.chineuses}
            placeholder="Nom de la chineuse"
            onAdd={(v) => addToArray('chineuses', v)}
            onRemove={(v) => removeFromArray('chineuses', v)}
            color="blue"
          />

          {/* Catégories contient */}
          <FieldArray
            label="Catégorie contient"
            values={config.categoriesContient}
            placeholder="Ex: Sac, Robe, Manteau"
            onAdd={(v) => addToArray('categoriesContient', v)}
            onRemove={(v) => removeFromArray('categoriesContient', v)}
            color="green"
          />

          {/* Nom contient */}
          <FieldArray
            label="Nom du produit contient"
            values={config.nomContient}
            placeholder="Ex: Baguette, Trench"
            onAdd={(v) => addToArray('nomContient', v)}
            onRemove={(v) => removeFromArray('nomContient', v)}
            color="yellow"
          />

          {/* Description contient */}
          <FieldArray
            label="Description contient"
            values={config.descriptionContient}
            placeholder="Ex: soie, satin, sequin"
            onAdd={(v) => addToArray('descriptionContient', v)}
            onRemove={(v) => removeFromArray('descriptionContient', v)}
            color="orange"
          />

          {/* Marques */}
          <FieldArray
            label="Marques"
            values={config.marques}
            placeholder="Ex: Chanel, Hermès"
            onAdd={(v) => addToArray('marques', v)}
            onRemove={(v) => removeFromArray('marques', v)}
            color="purple"
          />

          {/* Prix */}
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

          {/* Jours récents (pour New In) */}
          {selectedPage === 'new-in' && (
            <div>
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

          {/* Bouton sauvegarder */}
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
    </div>
  )
}

// Composant réutilisable pour les champs tableau
function FieldArray({
  label,
  values,
  placeholder,
  onAdd,
  onRemove,
  color,
}: {
  label: string
  values: string[]
  placeholder: string
  onAdd: (v: string) => void
  onRemove: (v: string) => void
  color: 'blue' | 'green' | 'yellow' | 'orange' | 'purple'
}) {
  const [input, setInput] = useState('')

  const colors = {
    blue: 'bg-blue-100 text-blue-800',
    green: 'bg-green-100 text-green-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    orange: 'bg-orange-100 text-orange-800',
    purple: 'bg-purple-100 text-purple-800',
  }

  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {values.map((v) => (
            <span key={v} className={`inline-flex items-center gap-1 ${colors[color]} px-2 py-1 rounded text-sm`}>
              {v}
              <button onClick={() => onRemove(v)} className="hover:opacity-70">
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onAdd(input)
              setInput('')
            }
          }}
          className="border rounded px-3 py-2 flex-1"
          placeholder={placeholder}
        />
        <button
          onClick={() => {
            onAdd(input)
            setInput('')
          }}
          className="border rounded px-3 py-2 hover:bg-gray-50"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  )
}