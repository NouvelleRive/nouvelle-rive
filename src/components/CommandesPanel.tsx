// components/CommandesPanel.tsx
'use client'

import { useState, useEffect } from 'react'
import { collection, query, orderBy, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { Package, Clock, CheckCircle, Truck, XCircle, RefreshCw, FileText, ShoppingBag } from 'lucide-react'

// =====================
// TYPES
// =====================
interface Commande {
  id: string
  produit: string
  produitId: string
  imageUrl?: string
  marque?: string | null
  sku?: string
  taille?: string
  couleur?: string
  prix: number
  client: {
    nom: string
    prenom: string
    email: string
    telephone?: string
  }
  modeLivraison: 'livraison' | 'retrait'
  adresse?: {
    rue: string
    complementAdresse?: string
    codePostal: string
    ville: string
    pays: string
  } | null
  statut: 'payée' | 'preparee' | 'expediee' | 'retiree' | 'annulee'
  dateCommande: Date
  datePreparation?: Date
  dateExpedition?: Date
  numeroGroupe?: string
  regroupeAvec?: string[]
  numeroSuivi?: string
  transporteur?: string
  squareOrderId?: string
  userId?: string
  // Champs pour filtre par chineuse
  chineurEmail?: string
  chineur?: string
  vendeurEmail?: string
  // Source de la commande
  source?: 'site' | 'ebay' | 'square'
  ebayOrderId?: string
  ebayBuyerUsername?: string
}

interface GroupeCommandes {
  numeroGroupe: string
  commandes: Commande[]
  client: Commande['client']
  modeLivraison: 'livraison' | 'retrait'
  adresse?: Commande['adresse']
  totalPrix: number
}

interface CommandesPanelProps {
  mode?: 'admin' | 'vendeuse'
  vendeuseEmail?: string
  filterProduitIds?: string[]
  compact?: boolean
}

// =====================
// COMPONENT
// =====================
export default function CommandesPanel({ 
  mode = 'admin', 
  vendeuseEmail,
  filterProduitIds,
  compact = false 
}: CommandesPanelProps) {
  const [onglet, setOnglet] = useState<'attente' | 'historique'>('attente')
  const [commandesEnAttente, setCommandesEnAttente] = useState<Commande[]>([])
  const [commandesHistorique, setCommandesHistorique] = useState<Commande[]>([])
  const [groupes, setGroupes] = useState<GroupeCommandes[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  const [showModalExpedition, setShowModalExpedition] = useState(false)
  const [commandePourExpedition, setCommandePourExpedition] = useState<Commande | null>(null)
  const [numeroSuivi, setNumeroSuivi] = useState('')
  const [transporteur, setTransporteur] = useState('Colissimo')

  const chargerCommandes = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    
    try {
      // =====================
      // 1. Charger commandes Firebase (site + square)
      // =====================
      const qAll = query(
        collection(db, 'commandes'),
        orderBy('dateCommande', 'desc')
      )
      
      const snapAll = await getDocs(qAll)
      const commandesSite = snapAll.docs.map(docSnap => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          produit: data.produit || '',
          produitId: data.produitId || '',
          imageUrl: data.imageUrl || null,
          marque: data.marque || null,
          sku: data.sku || data.productSku || '',
          taille: data.taille || data.productTaille || '',
          couleur: data.couleur || data.productCouleur || '',
          prix: data.prix || 0,
          client: data.client || { nom: '', prenom: '', email: '' },
          modeLivraison: data.modeLivraison || 'retrait',
          adresse: data.adresse || null,
          statut: data.statut || 'payée',
          dateCommande: data.dateCommande?.toDate() || new Date(),
          datePreparation: data.datePreparation?.toDate(),
          dateExpedition: data.dateExpedition?.toDate(),
          numeroGroupe: data.numeroGroupe,
          regroupeAvec: data.regroupeAvec,
          numeroSuivi: data.numeroSuivi,
          transporteur: data.transporteur,
          squareOrderId: data.squareOrderId,
          userId: data.userId,
          chineurEmail: data.chineurEmail,
          chineur: data.chineur,
          vendeurEmail: data.vendeurEmail,
          source: data.source || (data.squareOrderId ? 'square' : 'site'),
        } as Commande
      })
      
      // =====================
      // 2. Charger commandes eBay
      // =====================
      let commandesEbay: Commande[] = []
      try {
        const qEbay = query(
          collection(db, 'ebayOrders'),
          orderBy('createdAt', 'desc')
        )
        const snapEbay = await getDocs(qEbay)
        commandesEbay = snapEbay.docs.map(docSnap => {
          const data = docSnap.data()
          
          // Mapper le statut eBay vers notre système
          let statut: Commande['statut'] = 'payée'
          const ebayStatus = (data.orderFulfillmentStatus || data.status || '').toLowerCase()
          if (ebayStatus === 'fulfilled' || ebayStatus === 'shipped') statut = 'expediee'
          else if (ebayStatus === 'cancelled') statut = 'annulee'
          else if (data.prepared || data.statut === 'preparee') statut = 'preparee'
          
          return {
            id: docSnap.id,
            produit: data.title || data.itemTitle || data.produit || 'Article eBay',
            produitId: data.productId || data.itemId || '',
            imageUrl: data.imageUrl || data.itemImage || null,
            marque: data.marque || null,
            sku: data.sku || data.legacyItemId || '',
            taille: data.taille || '',
            couleur: data.couleur || '',
            prix: data.totalPrice || data.prix || data.pricePaid || 0,
            client: {
              nom: data.buyerName || data.buyer?.username || 'Acheteur eBay',
              prenom: '',
              email: data.buyerEmail || data.buyer?.email || '',
              telephone: data.buyerPhone || '',
            },
            modeLivraison: 'livraison' as const,
            adresse: data.shippingAddress ? {
              rue: data.shippingAddress.addressLine1 || data.shippingAddress.rue || '',
              complementAdresse: data.shippingAddress.addressLine2 || '',
              codePostal: data.shippingAddress.postalCode || data.shippingAddress.codePostal || '',
              ville: data.shippingAddress.city || data.shippingAddress.ville || '',
              pays: data.shippingAddress.country || data.shippingAddress.pays || 'US',
            } : null,
            statut,
            dateCommande: data.createdAt?.toDate() || data.orderDate?.toDate() || new Date(),
            datePreparation: data.datePreparation?.toDate(),
            dateExpedition: data.dateExpedition?.toDate() || data.shippedDate?.toDate(),
            numeroSuivi: data.trackingNumber || data.numeroSuivi || '',
            transporteur: data.shippingCarrier || data.transporteur || '',
            source: 'ebay' as const,
            ebayOrderId: data.orderId || data.ebayOrderId || docSnap.id,
            ebayBuyerUsername: data.buyer?.username || data.buyerUsername || '',
            chineurEmail: data.chineurEmail || data.sellerEmail,
            chineur: data.chineur,
          } as Commande
        })
      } catch (err) {
        console.log('Pas de collection ebayOrders ou erreur:', err)
      }
      
      // =====================
      // 3. Fusionner toutes les commandes
      // =====================
      const toutes = [...commandesSite, ...commandesEbay]
      
      // Trier par date décroissante
      toutes.sort((a, b) => b.dateCommande.getTime() - a.dateCommande.getTime())
      
      // =====================
      // 4. Filtrage par chineuse
      // =====================
      let commandesFiltrees = toutes
      
      if (filterProduitIds && filterProduitIds.length > 0) {
        commandesFiltrees = toutes.filter(c => filterProduitIds.includes(c.produitId))
      } else if (vendeuseEmail) {
        commandesFiltrees = toutes.filter(c => 
          c.vendeurEmail === vendeuseEmail || 
          c.chineurEmail === vendeuseEmail ||
          c.chineur === vendeuseEmail
        )
      }
      
      const attente = commandesFiltrees.filter(c => ['payée', 'preparee'].includes(c.statut))
      const historique = commandesFiltrees.filter(c => ['expediee', 'retiree', 'annulee'].includes(c.statut))
      
      setCommandesEnAttente(attente)
      setCommandesHistorique(historique)
      
      // Groupes
      const groupesMap = new Map<string, GroupeCommandes>()
      attente.forEach(commande => {
        if (commande.numeroGroupe && commande.source !== 'ebay') {
          if (!groupesMap.has(commande.numeroGroupe)) {
            groupesMap.set(commande.numeroGroupe, {
              numeroGroupe: commande.numeroGroupe,
              commandes: [],
              client: commande.client,
              modeLivraison: commande.modeLivraison,
              adresse: commande.adresse,
              totalPrix: 0
            })
          }
          const groupe = groupesMap.get(commande.numeroGroupe)!
          groupe.commandes.push(commande)
          groupe.totalPrix += commande.prix
        }
      })
      setGroupes(Array.from(groupesMap.values()).filter(g => g.commandes.length > 1))
      
    } catch (error) {
      console.error('Erreur chargement commandes:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    chargerCommandes()
    const interval = setInterval(() => chargerCommandes(true), 30000)
    return () => clearInterval(interval)
  }, [mode, vendeuseEmail, filterProduitIds])

  const marquerPreparee = async (commande: Commande) => {
    try {
      const collectionName = commande.source === 'ebay' ? 'ebayOrders' : 'commandes'
      await updateDoc(doc(db, collectionName, commande.id), {
        statut: 'preparee',
        prepared: true,
        datePreparation: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
      await chargerCommandes(true)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la mise à jour')
    }
  }

  const marquerRetiree = async (commande: Commande) => {
    if (!confirm('Confirmer que le client a bien retiré sa commande ?')) return
    try {
      await updateDoc(doc(db, 'commandes', commande.id), {
        statut: 'retiree',
        dateRetrait: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
      await chargerCommandes(true)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la mise à jour')
    }
  }

  const ouvrirModalExpedition = (commande: Commande) => {
    setCommandePourExpedition(commande)
    setNumeroSuivi(commande.numeroSuivi || '')
    setTransporteur(commande.transporteur || 'Colissimo')
    setShowModalExpedition(true)
  }

  const marquerExpediee = async () => {
    if (!commandePourExpedition) return
    try {
      const collectionName = commandePourExpedition.source === 'ebay' ? 'ebayOrders' : 'commandes'
      
      await updateDoc(doc(db, collectionName, commandePourExpedition.id), {
        statut: 'expediee',
        orderFulfillmentStatus: 'FULFILLED',
        dateExpedition: Timestamp.now(),
        shippedDate: Timestamp.now(),
        numeroSuivi: numeroSuivi || null,
        trackingNumber: numeroSuivi || null,
        transporteur: transporteur || null,
        shippingCarrier: transporteur || null,
        updatedAt: Timestamp.now()
      })
      
      // Si c'est une commande eBay, on pourrait aussi appeler l'API eBay pour mettre à jour le tracking
      if (commandePourExpedition.source === 'ebay' && numeroSuivi) {
        try {
          await fetch('/api/ebay/update-tracking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: commandePourExpedition.ebayOrderId,
              trackingNumber: numeroSuivi,
              carrier: transporteur
            })
          })
        } catch (err) {
          console.warn('Erreur mise à jour tracking eBay:', err)
        }
      }
      
      setShowModalExpedition(false)
      setCommandePourExpedition(null)
      setNumeroSuivi('')
      setTransporteur('Colissimo')
      await chargerCommandes(true)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la mise à jour')
    }
  }

  const genererBordereau = (commande: Commande) => {
    window.open(`/bordereau?groupe=${commande.numeroGroupe || commande.id}`, '_blank')
  }

  // =====================
  // BADGES
  // =====================
  const SourceBadge = ({ source }: { source?: string }) => {
    // En mode vendeuse, on ne montre pas les badges de source
    if (mode === 'vendeuse') return null
    
    if (source === 'ebay') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
          <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
            <path d="M7.5 5.5c-1.1 0-2.1.4-2.9 1.1-.8.7-1.2 1.7-1.2 2.9s.4 2.1 1.2 2.9c.8.7 1.8 1.1 2.9 1.1h.6l-1.7 2.5h2.4l1.7-2.5h1.1l1.7 2.5h2.4l-1.7-2.5h.6c1.1 0 2.1-.4 2.9-1.1.8-.7 1.2-1.7 1.2-2.9s-.4-2.1-1.2-2.9c-.8-.7-1.8-1.1-2.9-1.1H7.5z"/>
          </svg>
          eBay
        </span>
      )
    }
    if (source === 'square') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
          <ShoppingBag size={10} />
          Square
        </span>
      )
    }
    return null
  }

  const Badge = ({ statut }: { statut: string }) => {
    const config: Record<string, { bg: string; icon: any; label: string }> = {
      payée: { bg: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'À préparer' },
      preparee: { bg: 'bg-blue-100 text-blue-800', icon: Package, label: 'Préparée' },
      expediee: { bg: 'bg-green-100 text-green-800', icon: Truck, label: 'Expédiée' },
      retiree: { bg: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Retirée' },
      annulee: { bg: 'bg-red-100 text-red-800', icon: XCircle, label: 'Annulée' }
    }
    const { bg, icon: Icon, label } = config[statut] || config.payée
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${bg}`}>
        <Icon size={12} />
        {label}
      </span>
    )
  }

  const commandesIndividuelles = commandesEnAttente.filter(c => {
    if (c.source === 'ebay') return true // eBay toujours individuel
    if (!c.numeroGroupe) return true
    const groupe = groupes.find(g => g.numeroGroupe === c.numeroGroupe)
    return !groupe || groupe.commandes.length <= 1
  })

  // Stats
  const statsEbay = commandesEnAttente.filter(c => c.source === 'ebay').length
  const statsSite = commandesEnAttente.filter(c => c.source !== 'ebay').length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C] mx-auto"></div>
          <p className="mt-3 text-gray-600">Chargement des commandes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={compact ? '' : 'space-y-6'}>
      {!compact && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Gestion des commandes</h2>
            <p className="text-sm text-gray-600 mt-1">
              {commandesEnAttente.length} commande(s) à traiter
              {mode !== 'vendeuse' && statsEbay > 0 && <span className="text-yellow-600"> • {statsEbay} eBay</span>}
              {groupes.length > 0 && ` • ${groupes.length} groupe(s)`}
            </p>
          </div>
          <button
            onClick={() => chargerCommandes(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      )}

      <div className="flex gap-4 border-b">
        <button
          onClick={() => setOnglet('attente')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            onglet === 'attente'
              ? 'text-[#22209C] border-b-2 border-[#22209C]'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          À traiter ({commandesEnAttente.length})
        </button>
        <button
          onClick={() => setOnglet('historique')}
          className={`px-4 py-2 font-medium text-sm transition-colors ${
            onglet === 'historique'
              ? 'text-[#22209C] border-b-2 border-[#22209C]'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Historique ({commandesHistorique.length})
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {onglet === 'attente' ? (
          <>
            {/* Groupes de commandes (site uniquement) */}
            {groupes.map(groupe => (
              <div key={groupe.numeroGroupe} className="bg-white rounded-lg shadow border-2 border-orange-300">
                <div className="bg-orange-50 px-4 py-3 border-b border-orange-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-orange-900">
                        📦 Groupe - {groupe.commandes.length} produits
                      </h3>
                      <p className="text-sm text-orange-700">
                        {groupe.client.prenom} {groupe.client.nom} • {groupe.client.email}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-orange-900">{groupe.totalPrix.toFixed(2)} €</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 space-y-3">
                  {groupe.commandes.map(commande => (
                    <div key={commande.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      {commande.imageUrl && (
                        <img src={commande.imageUrl} alt={commande.produit} className="w-16 h-16 object-cover rounded" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{commande.produit}</p>
                        <p className="text-xs text-gray-500">
                          {commande.sku && <span className="font-mono bg-gray-100 px-1 rounded mr-1">{commande.sku}</span>}
                          {commande.marque && <span>{commande.marque}</span>}
                          {commande.taille && <span> • T.{commande.taille}</span>}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">{commande.prix.toFixed(2)} €</p>
                        <Badge statut={commande.statut} />
                      </div>
                      <div className="flex flex-col gap-1">
                        {commande.statut === 'payée' && (
                          <button onClick={() => marquerPreparee(commande)} className="px-3 py-1.5 bg-[#22209C] text-white rounded text-xs hover:bg-[#1a1a7e]">
                            Préparée
                          </button>
                        )}
                        {commande.statut === 'preparee' && commande.modeLivraison === 'livraison' && (
                          <button onClick={() => ouvrirModalExpedition(commande)} className="px-3 py-1.5 bg-[#22209C] text-white rounded text-xs hover:bg-[#1a1a7e]">
                            Envoyée
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {groupe.adresse && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs font-semibold text-blue-900 mb-1">📍 Adresse de livraison</p>
                      <p className="text-xs text-blue-800">
                        {groupe.adresse.rue}<br />
                        {groupe.adresse.complementAdresse && <>{groupe.adresse.complementAdresse}<br /></>}
                        {groupe.adresse.codePostal} {groupe.adresse.ville}<br />
                        {groupe.adresse.pays}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Commandes individuelles */}
            {commandesIndividuelles.map(commande => (
              <div 
                key={commande.id} 
                className={`flex items-center gap-3 p-3 bg-white border rounded-lg hover:shadow-sm ${
                  mode !== 'vendeuse' && commande.source === 'ebay' ? 'border-l-4 border-l-yellow-400' : ''
                }`}
              >
                {commande.imageUrl ? (
                  <img src={commande.imageUrl} alt={commande.produit} className="w-14 h-14 object-cover rounded" />
                ) : (
                  <div className="w-14 h-14 bg-gray-100 rounded flex items-center justify-center text-gray-400">Ø</div>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{commande.produit}</p>
                    <SourceBadge source={commande.source} />
                  </div>
                  <p className="text-xs text-gray-500">
                    {commande.sku && <span className="font-mono bg-gray-100 px-1 rounded mr-1">{commande.sku}</span>}
                    {commande.marque && <span>{commande.marque}</span>}
                    {commande.taille && <span> • T.{commande.taille}</span>}
                  </p>
                  <p className="text-xs text-gray-400">
                    {commande.client.prenom} {commande.client.nom?.charAt(0)}.
                    {mode !== 'vendeuse' && commande.source === 'ebay' && commande.ebayBuyerUsername && (
                      <span className="text-yellow-600"> (@{commande.ebayBuyerUsername})</span>
                    )}
                    {' • '}
                    {commande.modeLivraison === 'livraison' ? '📦 Livraison' : '🏪 Retrait'}
                    {commande.adresse?.pays && commande.adresse.pays !== 'France' && (
                      <span className="ml-1 text-blue-600">🌍 {commande.adresse.pays}</span>
                    )}
                  </p>
                </div>
                
                <div className="text-right">
                  <p className="font-bold text-sm">{commande.prix.toFixed(2)} €</p>
                  <Badge statut={commande.statut} />
                </div>
                
                <div className="flex gap-1">
                  {commande.statut === 'payée' && (
                    <button onClick={() => marquerPreparee(commande)} className="px-3 py-1.5 bg-[#22209C] text-white rounded text-xs hover:bg-[#1a1a7e]">
                      Préparée
                    </button>
                  )}
                  {commande.statut === 'preparee' && commande.modeLivraison === 'livraison' && (
                    <button onClick={() => ouvrirModalExpedition(commande)} className="px-3 py-1.5 bg-[#22209C] text-white rounded text-xs hover:bg-[#1a1a7e]">
                      Envoyée
                    </button>
                  )}
                  {commande.statut === 'preparee' && commande.modeLivraison === 'retrait' && (
                    <button onClick={() => marquerRetiree(commande)} className="px-3 py-1.5 bg-[#22209C] text-white rounded text-xs hover:bg-[#1a1a7e]">
                      Récupérée
                    </button>
                  )}
                  <button onClick={() => genererBordereau(commande)} className="p-1.5 hover:bg-gray-100 rounded" title="Bordereau">
                    <FileText size={16} className="text-gray-500" />
                  </button>
                </div>
              </div>
            ))}

            {commandesEnAttente.length === 0 && (
              <div className="text-center py-12">
                <Package size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Aucune commande à traiter</p>
              </div>
            )}
          </>
        ) : (
          <>
            {commandesHistorique.map(commande => (
              <div 
                key={commande.id} 
                className={`flex items-center gap-3 p-3 bg-white border rounded-lg ${
                  mode !== 'vendeuse' && commande.source === 'ebay' ? 'border-l-4 border-l-yellow-400' : ''
                }`}
              >
                {commande.imageUrl ? (
                  <img src={commande.imageUrl} alt={commande.produit} className="w-12 h-12 object-cover rounded" />
                ) : (
                  <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">Ø</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm truncate">{commande.produit}</p>
                    <SourceBadge source={commande.source} />
                  </div>
                  <p className="text-xs text-gray-500">
                    {commande.sku && <span className="font-mono bg-gray-100 px-1 rounded mr-1">{commande.sku}</span>}
                    {commande.marque}{commande.taille && ` • T.${commande.taille}`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {commande.client.prenom} {commande.client.nom} • {commande.dateCommande.toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{commande.prix.toFixed(2)} €</p>
                  <Badge statut={commande.statut} />
                  {commande.numeroSuivi && (
                    <p className="text-xs text-gray-500 mt-1">Suivi: {commande.numeroSuivi}</p>
                  )}
                </div>
              </div>
            ))}
            
            {commandesHistorique.length === 0 && (
              <div className="text-center py-12">
                <Package size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">Aucune commande dans l'historique</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Expédition */}
      {showModalExpedition && commandePourExpedition && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4">
              📦 Expédition
              {mode !== 'vendeuse' && commandePourExpedition.source === 'ebay' && (
                <span className="ml-2 text-sm font-normal text-yellow-600">(eBay)</span>
              )}
            </h3>
            
            {commandePourExpedition.adresse && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs font-semibold text-blue-900 mb-1">📍 Destination</p>
                <p className="text-sm text-blue-800">
                  {commandePourExpedition.client.prenom} {commandePourExpedition.client.nom}<br />
                  {commandePourExpedition.adresse.rue}<br />
                  {commandePourExpedition.adresse.codePostal} {commandePourExpedition.adresse.ville}<br />
                  <span className="font-medium">{commandePourExpedition.adresse.pays}</span>
                </p>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transporteur</label>
                <select
                  value={transporteur}
                  onChange={(e) => setTransporteur(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="Colissimo">Colissimo</option>
                  <option value="Chronopost">Chronopost</option>
                  <option value="La Poste International">La Poste International</option>
                  <option value="Mondial Relay">Mondial Relay</option>
                  <option value="DHL">DHL</option>
                  <option value="UPS">UPS</option>
                  <option value="FedEx">FedEx</option>
                  <option value="USPS">USPS</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Numéro de suivi {mode !== 'vendeuse' && commandePourExpedition.source === 'ebay' && <span className="text-yellow-600">(requis pour eBay)</span>}
                </label>
                <input
                  type="text"
                  value={numeroSuivi}
                  onChange={(e) => setNumeroSuivi(e.target.value)}
                  placeholder="Ex: 1A23456789012"
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowModalExpedition(false)
                  setCommandePourExpedition(null)
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Annuler
              </button>
              <button
                onClick={marquerExpediee}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}