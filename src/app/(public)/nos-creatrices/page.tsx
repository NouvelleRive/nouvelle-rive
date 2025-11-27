'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'

type Creatrice = {
  id: string
  nom: string
  specialite: string
  imageUrl: string
  slug: string
  ordre: number
}

export default function NosCreateursPage() {
  const [creatrices, setCreatrices] = useState<Creatrice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Fetch créatrices depuis Firebase
  useEffect(() => {
    async function fetchCreateurices() {
      try {
        const q = query(
          collection(db, 'chineuse'),
          where('displayOnWebsite', '==', true),
          orderBy('ordre', 'asc')
        )
        
        const querySnapshot = await getDocs(q)
        
        const data: Creatrice[] = []
        querySnapshot.forEach((doc) => {
          const docData = doc.data()
          data.push({
            id: doc.id,
            nom: docData.nom || doc.id,
            specialite: docData.specialite || '',
            imageUrl: docData.imageUrl || '',
            slug: docData.slug || doc.id,
            ordre: docData.ordre || 999,
          })
        })
        
        setCreatrices(data)
      } catch (error) {
        console.error('Erreur lors du fetch des créatrices:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCreateurices()
  }, [])

  const filtered = creatrices.filter(c => 
    c.nom.toLowerCase().includes(search.toLowerCase()) ||
    c.specialite.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="uppercase tracking-widest" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: '11px' }}>
            Chargement...
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="py-12 text-center" style={{ borderBottom: '1px solid #000' }}>
        <h1 
          className="uppercase tracking-widest"
          style={{ 
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            fontSize: '12px',
            letterSpacing: '0.2em'
          }}
        >
          Nos Créatrices/Curateurices
        </h1>
      </div>

      {/* Recherche */}
      <div className="py-6 px-6" style={{ borderBottom: '1px solid #000' }}>
        <div className="max-w-md mx-auto relative">
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full py-3 px-4 pr-12 text-xs tracking-widest bg-transparent outline-none"
            style={{ 
              fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
              border: '1px solid #000',
            }}
          />
          <svg 
            className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <p 
          className="text-center mt-4 uppercase"
          style={{ 
            fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
            fontSize: '10px',
            color: '#666'
          }}
        >
          {filtered.length} créatrice{filtered.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Grille */}
      <div 
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
        style={{ borderLeft: '1px solid #000' }}
      >
        {filtered.map((c) => (
          <Link 
            key={c.id} 
            href={`/nos-creatrices/${c.slug}`}
            className="group"
            style={{ borderRight: '1px solid #000', borderBottom: '1px solid #000' }}
          >
            <div className="aspect-square bg-gray-100 overflow-hidden relative">
              {c.imageUrl ? (
                <img
                  src={c.imageUrl}
                  alt={c.nom}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  onError={(e) => { e.currentTarget.style.display = 'none' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <p className="text-gray-400 text-xs uppercase tracking-wider">Image à venir</p>
                </div>
              )}
            </div>
            <div className="py-4 px-3 text-center bg-white">
              <h2 
                className="uppercase font-semibold"
                style={{ 
                  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                  fontSize: '11px',
                }}
              >
                {c.nom}
              </h2>
              <p 
                className="mt-1 uppercase"
                style={{ 
                  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                  fontSize: '10px',
                  color: '#666'
                }}
              >
                {c.specialite}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && !loading && (
        <div className="py-20 text-center">
          <p className="uppercase tracking-widest text-gray-400" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontSize: '11px' }}>
            Aucun résultat
          </p>
        </div>
      )}
    </main>
  )
}