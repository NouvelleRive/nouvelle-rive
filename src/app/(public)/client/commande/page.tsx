// app/client/commande/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { onAuthStateChanged, User } from 'firebase/auth'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { auth, db } from '@/lib/firebaseConfig'

type Commande = {
  id: string
  dateCommande: any
  produit: string
  prix: number
  statut: string
  modeLivraison: string
}

export default function CommandesPage() {
  const [user, setUser] = useState<User | null>(null)
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/client/login')
        return
      }
      
      setUser(currentUser)
      
      // Charger les commandes
      try {
        const q = query(
          collection(db, 'commandes'),
          where('client.email', '==', currentUser.email),
          orderBy('dateCommande', 'desc')
        )
        const snapshot = await getDocs(q)
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Commande[]
        setCommandes(data)
      } catch (error) {
        console.error('Erreur chargement commandes:', error)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/client" className="text-sm hover:underline">
            ← Retour à mon compte
          </Link>
        </div>

        <h1 className="text-4xl font-bold uppercase mb-8">MES COMMANDES</h1>

        <div style={{ borderBottom: '1px solid #000' }} className="mb-8" />

        {commandes.length === 0 ? (
          <p className="text-gray-500">Aucune commande pour le moment.</p>
        ) : (
          <div className="space-y-4">
            {commandes.map((commande) => (
              <div 
                key={commande.id} 
                className="p-4 border border-black"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{commande.produit}</p>
                    <p className="text-sm text-gray-600">
                      {commande.dateCommande?.toDate?.().toLocaleDateString('fr-FR') || 'Date inconnue'}
                    </p>
                    <p className="text-sm">{commande.modeLivraison === 'livraison' ? 'Livraison' : 'Retrait en boutique'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{commande.prix} €</p>
                    <span 
                      className="inline-block px-2 py-1 text-xs uppercase"
                      style={{
                        backgroundColor: commande.statut === 'payée' ? '#22C55E' : '#EAB308',
                        color: 'white'
                      }}
                    >
                      {commande.statut || 'En attente'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}