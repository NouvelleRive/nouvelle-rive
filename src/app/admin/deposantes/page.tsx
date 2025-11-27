// app/admin/deposants/page.tsx
'use client'

import { useState, useMemo } from 'react'
import { useAdmin } from '@/lib/admin/context'
import { Search } from 'lucide-react'

export default function AdminDeposantsPage() {
  const { selectedChineuse, deposants, produits, loading } = useAdmin()
  const [rechercheDeposant, setRechercheDeposant] = useState('')

  // Filtrer les déposants par chineuse sélectionnée
  const deposantsFiltresParChineuse = useMemo(() => {
    if (!selectedChineuse) return deposants
    return deposants.filter((d: any) => d.id === selectedChineuse.uid || d.email === selectedChineuse.email)
  }, [deposants, selectedChineuse])

  // Filtrer par recherche
  const deposantsFiltres = deposantsFiltresParChineuse.filter((d: any) => {
    if (!rechercheDeposant) return true
    return [d.email, d.nom, d.trigramme].filter(Boolean).join(' ').toLowerCase().includes(rechercheDeposant.toLowerCase())
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
      </div>
    )
  }

  return (
    <>
      {/* Barre de recherche (seulement si pas de chineuse sélectionnée) */}
      {!selectedChineuse && (
        <div className="bg-white border rounded p-4 mb-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              value={rechercheDeposant} 
              onChange={(e) => setRechercheDeposant(e.target.value)} 
              placeholder="Rechercher..." 
              className="w-full pl-10 pr-4 py-2 border rounded text-sm" 
            />
          </div>
        </div>
      )}

      {/* Liste des déposants */}
      <div className="space-y-4">
        {deposantsFiltres.map((d: any) => {
          const rawCats = d?.['Catégorie'] ?? d?.categories ?? []
          const cats = Array.isArray(rawCats) ? rawCats.map((c: any) => typeof c === 'object' ? (c.label ?? '') : c).filter(Boolean) : []
          const nbProduits = produits.filter((p) => p.chineur === d.email || p.chineurUid === d.id).length
          const nbVendus = produits.filter((p) => (p.chineur === d.email || p.chineurUid === d.id) && p.vendu).length
          const caTotal = produits.filter((p) => (p.chineur === d.email || p.chineurUid === d.id) && p.vendu).reduce((sum, p) => sum + (p.prixVenteReel ?? p.prix ?? 0), 0)
          
          // Champs supplémentaires
          const accroche = d?.accroche || d?.Accroche || ''
          const description = d?.description || d?.Description || d?.bio || d?.Bio || ''
          
          return (
            <div key={d.id} className="bg-white border rounded-lg overflow-hidden">
              {/* Header avec trigramme et stats */}
              <div className="p-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  {/* Trigramme */}
                  <div className="w-14 h-14 bg-[#22209C] text-white rounded-lg flex items-center justify-center font-bold text-lg flex-shrink-0">
                    {d.trigramme || '?'}
                  </div>
                  
                  {/* Infos principales */}
                  <div className="flex-1">
                    <p className="font-bold text-lg">{(d.nom || d.email.split('@')[0]).toUpperCase()}</p>
                    <p className="text-sm text-gray-500">{d.email}</p>
                    
                    {/* Accroche */}
                    {accroche && (
                      <p className="text-sm text-[#22209C] font-medium mt-1 italic">"{accroche}"</p>
                    )}
                  </div>
                </div>
                
                {/* Stats */}
                <div className="flex items-center gap-4 text-sm flex-shrink-0">
                  <div className="text-center px-3 py-2 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 text-xs">Produits</p>
                    <p className="font-bold text-lg">{nbProduits}</p>
                  </div>
                  <div className="text-center px-3 py-2 bg-green-50 rounded-lg">
                    <p className="text-gray-500 text-xs">Ventes</p>
                    <p className="font-bold text-lg text-green-600">{nbVendus}</p>
                  </div>
                  <div className="text-center px-3 py-2 bg-blue-50 rounded-lg">
                    <p className="text-gray-500 text-xs">CA</p>
                    <p className="font-bold text-lg text-[#22209C]">{caTotal.toFixed(0)} €</p>
                  </div>
                </div>
              </div>
              
              {/* Description */}
              {description && (
                <div className="px-4 pb-3">
                  <p className="text-sm text-gray-600 line-clamp-2">{description}</p>
                </div>
              )}
              
              {/* Catégories */}
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
        
        {!deposantsFiltres.length && (
          <p className="text-center text-gray-400 py-8">Aucune déposante</p>
        )}
      </div>
    </>
  )
}