// components/CommandesPanel.tsx
'use client'

import { useState, useEffect } from 'react'
import { collection, query, orderBy, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebaseConfig'
import { Package, RefreshCw, FileText, ShoppingBag } from 'lucide-react'
import { formatPrix } from '@/lib/formatPrix'

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

interface CommandesPanelProps {
  mode?: 'admin' | 'vendeuse'
  vendeuseEmail?: string
  filterProduitIds?: string[]
  compact?: boolean
}

type Onglet = 'apreparer' | 'aposter' | 'historique'

// =====================
// COMPONENT
// =====================
export default function CommandesPanel({
  mode = 'admin',
  vendeuseEmail,
  filterProduitIds,
  compact = false
}: CommandesPanelProps) {
  const [onglet, setOnglet] = useState<Onglet>('apreparer')
  const [aPreparer, setAPreparer] = useState<Commande[]>([])
  const [aPoster, setAPoster] = useState<Commande[]>([])
  const [historique, setHistorique] = useState<Commande[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [showModalExpedition, setShowModalExpedition] = useState(false)
  const [commandePourExpedition, setCommandePourExpedition] = useState<Commande | null>(null)
  const [numeroSuivi, setNumeroSuivi] = useState('')
  const [transporteur, setTransporteur] = useState('Colissimo')

  const bordereauBase = mode === 'vendeuse' ? '/vendeuse/commandes/bordereau' : '/admin/nos-commandes/bordereau'

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
          produit: data.produit || data.productName || '',
          produitId: data.produitId || data.productId || '',
          imageUrl: data.imageUrl || data.productImage || null,
          marque: data.marque || data.productMarque || null,
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
      // 3. Fusionner + trier
      // =====================
      const toutes = [...commandesSite, ...commandesEbay]
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

      // =====================
      // 5. Répartition par onglet (le statut découle de l'onglet, pas de badge)
      // =====================
      setAPreparer(commandesFiltrees.filter(c => c.statut === 'payée'))
      setAPoster(commandesFiltrees.filter(c => c.statut === 'preparee'))
      setHistorique(commandesFiltrees.filter(c => ['expediee', 'retiree', 'annulee'].includes(c.statut)))

    } catch (error) {
      console.error('Erreur chargement commandes:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    chargerCommandes()
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      chargerCommandes(true)
    }, 30000)
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
      alert('Erreur : FI')
    }
  }

  const marquerRetiree = async (commande: Commande) => {
    if (!confirm('Confirmer que le client a bien récupéré sa commande ?')) return
    try {
      await updateDoc(doc(db, 'commandes', commande.id), {
        statut: 'retiree',
        dateRetrait: Timestamp.now(),
        updatedAt: Timestamp.now()
      })
      await chargerCommandes(true)
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur : FI')
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

      // eBay : pousser le tracking vers l'API
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
      alert('Erreur : FI')
    }
  }

  const genererBordereau = (commande: Commande) => {
    window.open(`${bordereauBase}?groupe=${commande.numeroGroupe || commande.id}`, '_blank')
  }

  // =====================
  // BADGE SOURCE (admin uniquement)
  // =====================
  const SourceBadge = ({ source }: { source?: string }) => {
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
          Boutique
        </span>
      )
    }
    return null
  }

  // Date lisible : "20/07 à 19:39"
  const formatDate = (d: Date) =>
    `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`

  // =====================
  // CARTE (à préparer & à poster)
  // =====================
  const Carte = ({ commande }: { commande: Commande }) => {
    const livraison = commande.modeLivraison === 'livraison'
    const { client, adresse } = commande
    return (
      <div className={`bg-white border rounded-lg p-4 space-y-3 ${
        mode !== 'vendeuse' && commande.source === 'ebay' ? 'border-l-4 border-l-yellow-400' : ''
      }`}>
        {/* Ligne produit */}
        <div className="flex gap-3">
          {commande.imageUrl ? (
            <img src={commande.imageUrl} alt={commande.produit} className="w-16 h-16 object-cover rounded flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-400 flex-shrink-0">Ø</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm">{commande.produit}</p>
              <SourceBadge source={commande.source} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {commande.sku && <span className="font-mono bg-gray-100 px-1 rounded mr-1">{commande.sku}</span>}
              {commande.marque && <span>{commande.marque}</span>}
              {commande.taille && <span> • T.{commande.taille}</span>}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Commandé le {formatDate(commande.dateCommande)}</p>
          </div>
          <p className="font-bold text-sm whitespace-nowrap">{formatPrix(commande.prix, { decimals: 2 })} €</p>
        </div>

        {/* Bloc destinataire — nom + adresse pour le colis */}
        <div className="text-sm bg-gray-50 rounded-lg p-3 leading-relaxed">
          <p className="font-semibold text-gray-900">
            {client.prenom} {client.nom}
          </p>
          {livraison ? (
            adresse ? (
              <p className="text-gray-700">
                {adresse.rue}<br />
                {adresse.complementAdresse && <>{adresse.complementAdresse}<br /></>}
                {adresse.codePostal} {adresse.ville}<br />
                {adresse.pays}
              </p>
            ) : (
              <p className="text-red-500 text-xs">⚠️ Adresse manquante</p>
            )
          ) : null}
          {client.telephone && <p className="text-gray-600 mt-1">📞 {client.telephone}</p>}
          <p className="text-gray-500 text-xs mt-1">
            {livraison ? '📦 Livraison' : '🏪 Retrait en boutique'}
            {adresse?.pays && adresse.pays !== 'France' && adresse.pays !== 'FR' && (
              <span className="ml-1 text-blue-600">🌍 {adresse.pays}</span>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onglet === 'apreparer' ? (
            <button
              onClick={() => marquerPreparee(commande)}
              className="flex-1 px-4 py-2 bg-[#22209C] text-white rounded-lg text-sm font-medium hover:bg-[#1a1a7e]"
            >
              Préparée
            </button>
          ) : livraison ? (
            <button
              onClick={() => ouvrirModalExpedition(commande)}
              className="flex-1 px-4 py-2 bg-[#22209C] text-white rounded-lg text-sm font-medium hover:bg-[#1a1a7e]"
            >
              Postée
            </button>
          ) : (
            <button
              onClick={() => marquerRetiree(commande)}
              className="flex-1 px-4 py-2 bg-[#22209C] text-white rounded-lg text-sm font-medium hover:bg-[#1a1a7e]"
            >
              Récupérée
            </button>
          )}
          {commande.numeroGroupe && (
            <button
              onClick={() => genererBordereau(commande)}
              className="p-2 border rounded-lg hover:bg-gray-100"
              title="Bordereau à imprimer"
            >
              <FileText size={18} className="text-gray-500" />
            </button>
          )}
        </div>
      </div>
    )
  }

  // Libellé de sortie dans l'historique (sans badge de statut)
  const libelleHistorique = (c: Commande) => {
    if (c.statut === 'expediee') return c.dateExpedition ? `Postée le ${c.dateExpedition.toLocaleDateString('fr-FR')}` : 'Postée'
    if (c.statut === 'retiree') return 'Récupérée en boutique'
    if (c.statut === 'annulee') return 'Annulée'
    return ''
  }

  const listeActive = onglet === 'apreparer' ? aPreparer : onglet === 'aposter' ? aPoster : historique

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
              {aPreparer.length + aPoster.length} commande(s) en cours
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

      {/* Onglets — les 3 tiennent en pleine largeur, pas de scroll */}
      <div className="flex border-b">
        {([
          { key: 'apreparer', label: 'À préparer', count: aPreparer.length },
          { key: 'aposter', label: 'À poster', count: aPoster.length },
          { key: 'historique', label: 'Historique', count: historique.length },
        ] as { key: Onglet; label: string; count: number }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setOnglet(t.key)}
            className={`flex-1 px-1 py-2 font-medium text-[13px] text-center whitespace-nowrap transition-colors ${
              onglet === t.key
                ? 'text-[#22209C] border-b-2 border-[#22209C]'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="mt-4 space-y-4">
        {onglet !== 'historique' ? (
          <>
            {listeActive.map(commande => (
              <Carte key={commande.id} commande={commande} />
            ))}
            {listeActive.length === 0 && (
              <div className="text-center py-12">
                <Package size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500">
                  {onglet === 'apreparer' ? 'Aucune commande à préparer' : 'Aucune commande à poster'}
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            {historique.map(commande => (
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
                    {commande.client.prenom} {commande.client.nom} • {libelleHistorique(commande)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-sm">{formatPrix(commande.prix, { decimals: 2 })} €</p>
                  {commande.numeroSuivi && (
                    <p className="text-xs text-gray-500 mt-1">Suivi : {commande.numeroSuivi}</p>
                  )}
                </div>
              </div>
            ))}

            {historique.length === 0 && (
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
              📦 Marquer comme postée
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
