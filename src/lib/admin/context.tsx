// lib/admin/context.tsx
'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { collection, getDocs, Timestamp } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/lib/firebaseConfig'
import { rehydrateTimestamps } from '@/lib/rehydrateTimestamps'

// =====================
// TYPES
// =====================
export type Chineuse = {
  uid: string
  email: string
  nom?: string
  trigramme?: string
  categoriesAutorisees?: string[]
  accroche?: string
  description?: string
  /** 'unique' (par défaut, pièce unique) ou 'smallBatch' (restock multi-quantité) */
  stockType?: 'unique' | 'smallBatch'
}

export type Cat = {
  id: string
  label: string
  idsquare?: string
}

export type Produit = {
  id: string
  nom: string
  description?: string
  categorie?: any
  prix?: number
  quantite?: number
  sku?: string
  marque?: string
  taille?: string
  material?: string
  color?: string
  madeIn?: string
  photos?: {
    face?: string
    faceOnModel?: string
    dos?: string
    details?: string[]
  }
  imageUrl?: string
  imageUrls?: string[]
  chineur?: string
  chineurUid?: string
  vendu?: boolean
  createdAt?: Timestamp
  dateVente?: Timestamp
  prixVenteReel?: number
  statut?: 'retour' | 'supprime' | 'vendu'
  dateRetour?: Timestamp | string
  photosReady?: boolean
  catalogObjectId?: string
  variationId?: string
  itemId?: string
  trigramme?: string
  ebayListingId?: string
  ebayOfferId?: string
  ebayPublishedAt?: Timestamp
  publishedOn?: string[]
}

export type Deposant = {
  id: string
  email: string
  nom?: string
  trigramme?: string
  categoriesAutorisees?: string[]
  accroche?: string
  description?: string
  createdAt?: Timestamp
}

// =====================
// CONTEXT
// =====================
interface AdminContextType {
  // État
  selectedChineuse: Chineuse | null
  setSelectedChineuse: (c: Chineuse | null) => void
  
  // Données
  chineusesList: Chineuse[]
  produits: Produit[]
  deposants: Deposant[]
  categories: Cat[]
  
  // Données filtrées
  produitsFiltres: Produit[]
  
  // Chargement
  loading: boolean
  loadData: () => Promise<void>
  
  // Helpers
  autoSku: string
  setAutoSku: (s: string) => void
}

const AdminContext = createContext<AdminContextType | undefined>(undefined)

// =====================
// PROVIDER
// =====================
const SELECTED_CHINEUSE_KEY = 'admin.selectedChineuseUid'

export function AdminProvider({ children }: { children: ReactNode }) {
  const [selectedChineuse, setSelectedChineuseState] = useState<Chineuse | null>(null)
  const setSelectedChineuse = (c: Chineuse | null) => {
    setSelectedChineuseState(c)
    try {
      if (c) localStorage.setItem(SELECTED_CHINEUSE_KEY, c.uid)
      else localStorage.removeItem(SELECTED_CHINEUSE_KEY)
    } catch {}
  }
  const [chineusesList, setChineusesList] = useState<Chineuse[]>([])
  const [produits, setProduits] = useState<Produit[]>([])
  const [deposants, setDeposants] = useState<Deposant[]>([])
  const [categories, setCategories] = useState<Cat[]>([])
  const [loading, setLoading] = useState(true)
  const [autoSku, setAutoSku] = useState('')

  // Charger les données
  const loadData = async () => {
    setLoading(true)
    try {
      // Produits — servis depuis le cache blob via route admin authentifiée
      // (0 read Firestore par session admin, au lieu d'un scan de ~5000 docs).
      // Le blob `produits-all` est patché à chaque écriture produit → données fraîches.
      const token = await auth.currentUser?.getIdToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined
      const prodRes = await fetch('/api/admin/produits-full', { headers, cache: 'no-store' })
      const prodJson = prodRes.ok ? await prodRes.json() : { produits: [] }
      // rehydrateTimestamps : la route sérialise les Timestamps admin en
      // { _seconds, _nanoseconds } — on les reconvertit pour que .toDate()/instanceof marchent.
      const produitsData = (rehydrateTimestamps(Array.isArray(prodJson.produits) ? prodJson.produits : []) as Produit[])
        // Ordre historique : plus récents d'abord (avant : orderBy createdAt desc côté Firestore).
        .sort((a, b) => {
          const ta = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0
          const tb = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0
          return tb - ta
        })
      setProduits(produitsData)

      // Déposants (from chineuse collection)
      const snapUsers = await getDocs(collection(db, 'chineuse'))
      const usersData = snapUsers.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((u: any) => u.trigramme) as Deposant[]
      setDeposants(usersData)

      // Liste des chineuses pour le dropdown — on inclut stockType pour les
      // règles d'affichage des boutons d'import Vinted/Whatnot (NR/smallBatch/unique).
      const chineuses = usersData.map((u: any) => ({
        uid: u.id,
        email: u.email,
        nom: u.nom,
        trigramme: u.trigramme,
        categoriesAutorisees: u.categoriesAutorisees,
        accroche: u.accroche,
        description: u.description,
        stockType: u.stockType,
      }))
      setChineusesList(chineuses)

      // Restaurer la sélection persistée (si toujours valide)
      try {
        const savedUid = localStorage.getItem(SELECTED_CHINEUSE_KEY)
        if (savedUid) {
          const found = chineuses.find(c => c.uid === savedUid)
          if (found) setSelectedChineuseState(found)
          else localStorage.removeItem(SELECTED_CHINEUSE_KEY)
        }
      } catch {}

      // Catégories
      const snapCats = await getDocs(collection(db, 'categories'))
      const catsData = snapCats.docs.map(d => ({ id: d.id, ...d.data() })) as Cat[]
      setCategories(catsData)

    } catch (error) {
      console.error('Erreur chargement données:', error)
    } finally {
      setLoading(false)
    }
  }

  // Le provider est monté au-dessus du gate d'auth du layout : au tout premier
  // rendu, auth.currentUser peut être null. On attend donc l'état d'auth pour
  // que le token soit disponible avant d'appeler la route admin authentifiée.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) loadData()
    })
    return () => unsub()
  }, [])

  // Calculer le prochain SKU quand une chineuse est sélectionnée
  useEffect(() => {
    if (selectedChineuse?.trigramme) {
      const tri = selectedChineuse.trigramme.toUpperCase()
      const produitsChineuse = produits.filter(p => 
        p.sku?.toUpperCase().startsWith(tri)
      )
      const nums = produitsChineuse.map(p => {
        const match = p.sku?.match(/\d+/)
        return match ? parseInt(match[0], 10) : 0
      })
      const maxNum = nums.length > 0 ? Math.max(...nums) : 0
      setAutoSku(`${tri}${maxNum + 1}`)
    } else {
      setAutoSku('')
    }
  }, [selectedChineuse, produits])

  // Produits filtrés par chineuse
  const produitsFiltres = selectedChineuse
    ? produits.filter(p => 
        p.chineur === selectedChineuse.email || 
        p.chineurUid === selectedChineuse.uid ||
        p.sku?.toUpperCase().startsWith(selectedChineuse.trigramme?.toUpperCase() || '???')
      )
    : produits

  return (
    <AdminContext.Provider value={{
      selectedChineuse,
      setSelectedChineuse,
      chineusesList,
      produits,
      deposants,
      categories,
      produitsFiltres,
      loading,
      loadData,
      autoSku,
      setAutoSku,
    }}>
      {children}
    </AdminContext.Provider>
  )
}

// =====================
// HOOK
// =====================
export function useAdmin() {
  const context = useContext(AdminContext)
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider')
  }
  return context
}