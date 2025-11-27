// app/client/commande/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { doc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '@/lib/firebaseConfig'

type Article = {
  id: string
  nom: string
  prix: number
  imageUrl: string
  marque?: string
}

type Commande = {
  id: string
  date: string
  total: number
  statut: 'en_preparation' | 'expedie' | 'livre' | 'en_attente_retrait'
  articles: Article[]
  modeLivraison: 'retrait' | 'livraison'
  clientInfo: {
    prenom: string
    nom: string
    email: string
    telephone?: string
  }
  adresse?: {
    adresse: string
    codePostal: string
    ville: string
    pays: string
  }
}

export default function CommandeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [commande, setCommande] = useState<Commande | null>(null)
  const [loading, setLoading] = useState(true)

  const fontHelvetica = '"Helvetica Neue", Helvetica, Arial, sans-serif'
  const bleuElectrique = '#0000FF'

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/client/login')
        return
      }

      try {
        const docRef = doc(db, 'commandes', params.id as string)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          const data = docSnap.data()
          // Vérifier que la commande appartient bien à l'utilisateur
          if (data.userId === currentUser.uid) {
            setCommande({ id: docSnap.id, ...data } as Commande)
          } else {
            router.push('/client')
          }
        }
      } catch (error) {
        console.error('Erreur:', error)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [params.id, router])

  const getStatutInfo = (statut: string) => {
    const infos = {
      'en_preparation': {
        label: 'EN PRÉPARATION',
        color: '#FFA500',
        message: 'Votre commande est en cours de préparation dans notre boutique.',
        icon: '📦'
      },
      'expedie': {
        label: 'EXPÉDIÉE',
        color: '#22C55E',
        message: 'Votre commande a été expédiée ! Vous devriez la recevoir sous 2-3 jours.',
        icon: '🚚'
      },
      'livre': {
        label: 'LIVRÉE',
        color: '#22C55E',
        message: 'Votre commande a été livrée ! On espère que vous allez adorer 💙',
        icon: '✅'
      },
      'en_attente_retrait': {
        label: 'PRÊTE À RETIRER',
        color: bleuElectrique,
        message: 'Votre commande est prête ! Venez la récupérer au 8 rue des Ecouffes, 75004 Paris.',
        icon: '🏪'
      }
    }
    return infos[statut as keyof typeof infos] || infos.en_preparation
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Chargement...</p>
      </div>
    )
  }

  if (!commande) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4">Commande introuvable</p>
          <Link href="/client" className="text-sm hover:underline" style={{ color: bleuElectrique }}>
            ← Retour à mes commandes
          </Link>
        </div>
      </div>
    )
  }

  const statutInfo = getStatutInfo(commande.statut)

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: fontHelvetica }}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* En-tête */}
        <div className="mb-8">
          <Link href="/client" className="text-sm hover:underline mb-4 inline-block">
            ← Retour à mes commandes
          </Link>
          
          <h1 
            className="uppercase mb-2"
            style={{ 
              fontSize: '36px',
              fontWeight: '700',
              letterSpacing: '-0.01em',
              lineHeight: '1'
            }}
          >
            COMMANDE #{commande.id.slice(0, 8).toUpperCase()}
          </h1>
          
          <p className="text-gray-600">
            Passée le {new Date(commande.date).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </p>
        </div>

        <div style={{ borderBottom: '1px solid #000' }} className="mb-8" />

        {/* Statut */}
        <div 
          className="p-6 mb-8 rounded-lg"
          style={{ backgroundColor: `${statutInfo.color}15`, border: `2px solid ${statutInfo.color}` }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span style={{ fontSize: '32px' }}>{statutInfo.icon}</span>
            <h2 
              className="uppercase"
              style={{ 
                fontSize: '18px',
                fontWeight: '600',
                letterSpacing: '0.1em',
                color: statutInfo.color
              }}
            >
              {statutInfo.label}
            </h2>
          </div>
          <p className="text-gray-700">{statutInfo.message}</p>
        </div>

        {/* Articles */}
        <div className="mb-8">
          <h2 
            className="uppercase mb-4"
            style={{ 
              fontSize: '18px',
              fontWeight: '600',
              letterSpacing: '0.1em'
            }}
          >
            VOS ARTICLES
          </h2>

          <div className="space-y-4">
            {commande.articles.map((article, idx) => (
              <div key={idx} className="flex gap-4 p-4 border border-gray-200 rounded-lg">
                <img 
                  src={article.imageUrl} 
                  alt={article.nom}
                  className="w-24 h-24 object-cover rounded"
                />
                <div className="flex-1">
                  {article.marque && (
                    <p 
                      className="uppercase mb-1"
                      style={{ 
                        fontSize: '10px',
                        letterSpacing: '0.2em',
                        color: '#999'
                      }}
                    >
                      {article.marque}
                    </p>
                  )}
                  <p className="font-semibold mb-2">{article.nom}</p>
                  <p className="text-lg font-bold">{article.prix.toFixed(2)} €</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderBottom: '1px solid #000' }} className="mb-8" />

        {/* Infos livraison/retrait */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div>
            <h2 
              className="uppercase mb-4"
              style={{ 
                fontSize: '18px',
                fontWeight: '600',
                letterSpacing: '0.1em'
              }}
            >
              MODE DE RÉCUPÉRATION
            </h2>
            
            {commande.modeLivraison === 'retrait' ? (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="font-semibold mb-2">🏪 Retrait en boutique</p>
                <p className="text-sm text-gray-600">8 rue des Ecouffes</p>
                <p className="text-sm text-gray-600">75004 Paris</p>
                <p className="text-sm text-gray-600 mt-2">Ouvert du mardi au samedi, 11h-19h</p>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="font-semibold mb-2">📦 Livraison à domicile</p>
                {commande.adresse && (
                  <>
                    <p className="text-sm text-gray-600">{commande.adresse.adresse}</p>
                    <p className="text-sm text-gray-600">
                      {commande.adresse.codePostal} {commande.adresse.ville}
                    </p>
                    <p className="text-sm text-gray-600">{commande.adresse.pays}</p>
                  </>
                )}
              </div>
            )}
          </div>

          <div>
            <h2 
              className="uppercase mb-4"
              style={{ 
                fontSize: '18px',
                fontWeight: '600',
                letterSpacing: '0.1em'
              }}
            >
              INFORMATIONS
            </h2>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm mb-1">
                <span className="font-semibold">Nom :</span> {commande.clientInfo.prenom} {commande.clientInfo.nom}
              </p>
              <p className="text-sm mb-1">
                <span className="font-semibold">Email :</span> {commande.clientInfo.email}
              </p>
              {commande.clientInfo.telephone && (
                <p className="text-sm">
                  <span className="font-semibold">Tél :</span> {commande.clientInfo.telephone}
                </p>
              )}
            </div>
          </div>
        </div>

        <div style={{ borderBottom: '1px solid #000' }} className="mb-8" />

        {/* Total */}
        <div className="flex justify-between items-center p-6 bg-gray-50 rounded-lg">
          <h2 
            className="uppercase"
            style={{ 
              fontSize: '18px',
              fontWeight: '600',
              letterSpacing: '0.1em'
            }}
          >
            TOTAL
          </h2>
          <p 
            className="text-3xl font-bold"
            style={{ color: bleuElectrique }}
          >
            {commande.total.toFixed(2)} €
          </p>
        </div>

        {/* Besoin d'aide */}
        <div className="mt-8 p-6 bg-blue-50 rounded-lg text-center">
          <p className="text-sm text-gray-700 mb-2">
            Une question sur votre commande ?
          </p>
          <a 
            href="mailto:nouvelleriveparis@gmail.com"
            className="text-sm font-semibold hover:underline"
            style={{ color: bleuElectrique }}
          >
            Contactez-nous : nouvelleriveparis@gmail.com
          </a>
        </div>
      </div>
    </div>
  )
}