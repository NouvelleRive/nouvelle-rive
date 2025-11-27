// lib/admin/context.tsx
'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'

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
export function AdminProvider({ children }: { children: ReactNode }) {
  const [selectedChineuse, setSelectedChineuse] = useState<Chineuse | null>(null)
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
      // Produits
      const snapProduits = await getDocs(query(collection(db, 'produits'), orderBy('createdAt', 'desc')))
      const produitsData = snapProduits.docs.map(d => ({ id: d.id, ...d.data() })) as Produit[]
      setProduits(produitsData)

      // Déposants (from chineuse collection)
      const snapUsers = await getDocs(collection(db, 'chineuse'))
      const usersData = snapUsers.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((u: any) => u.trigramme) as Deposant[]
      setDeposants(usersData)

      // Liste des chineuses pour le dropdown
      const chineuses = usersData.map(u => ({
        uid: u.id,
        email: u.email,
        nom: u.nom,
        trigramme: u.trigramme,
        categoriesAutorisees: u.categoriesAutorisees,
        accroche: u.accroche,
        description: u.description,
      }))
      setChineusesList(chineuses)

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

  useEffect(() => {
    loadData()
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