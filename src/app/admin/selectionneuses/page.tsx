  // app/admin/deposantes/page.tsx
  'use client'

  import { useState, useMemo, useEffect } from 'react'
  import { useAdmin } from '@/lib/admin/context'
  import { Search, Plus, X, Trash2, Edit2 } from 'lucide-react'
  import { getAuth } from 'firebase/auth'
  import { collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp, query, where } from 'firebase/firestore'
  import { db } from '@/lib/firebaseConfig'
  import PlanningCalendar from '@/components/PlanningCalendar'

  const CATEGORIES_DEPOSANTE = [
    { label: 'TODO', idsquare: 'TODO' },
  ]

  function generateTrigramme(prenom: string, nom: string): string {
    const p = prenom.trim().toUpperCase().replace(/[^A-Z]/g, '')
    const n = nom.trim().toUpperCase().replace(/[^A-Z]/g, '')
    if (!p && !n) return ''
    if (!p) return n.slice(0, 3)
    if (!n) return p.slice(0, 3)
    return p[0] + n.slice(0, 2)
  }

  async function findUniqueTrigramme(base: string, excludeUid?: string): Promise<string> {
    const snap = await getDocs(query(collection(db, 'deposante'), where('trigramme', '==', base)))
    const taken = snap.docs.filter(d => d.id !== excludeUid)
    if (taken.length === 0) return base
    for (let i = 2; i <= 99; i++) {
      const candidate = base + i
      const s2 = await getDocs(query(collection(db, 'deposante'), where('trigramme', '==', candidate)))
      if (s2.empty) return candidate
    }
    return base
  }

  type CategorieItem = {
    label: string
    idsquare: string
  }

  type CategorieRapportItem = {
    label: string
    idsquare: string
    nom?: string
    email?: string
    trigramme?: string
    siret?: string
    tva?: string
    iban?: string
    bic?: string
    banqueAdresse?: string
    adresse1?: string
    adresse2?: string
    taux?: number  // ← AJOUTÉ
  }

  type Deposante = {
    id: string
    nom?: string
    email?: string
    emails?: string[]
    trigramme?: string
    instagram?: string
    accroche?: string
    description?: string
    specialite?: string
    lien?: string
    imageUrl?: string
    ordre?: number
    displayOnWebsite?: boolean
    slug?: string
    createdAt?: any
    updatedAt?: any
    'Catégorie'?: CategorieItem[]
    'Catégorie de rapport'?: CategorieRapportItem[]
    siret?: string
    tva?: string
    iban?: string
    bic?: string
    banqueAdresse?: string
    adresse1?: string
    adresse2?: string
  }

  const EMPTY_FORM = {
    id: '',
    nom: '',
    trigramme: '',
    emails: [] as string[],
    instagram: '',
    accroche: '',
    description: '',
    specialite: '',
    lien: '',
    imageUrl: '',
    ordre: 0,
    categories: [] as CategorieItem[],
    categorieRapportLabel: '',
    categorieRapportIdsquare: '',
    taux: 40,
    siret: '',
    tva: '',
    iban: '',
    bic: '',
    banqueAdresse: '',
    adresse1: '',
    adresse2: '',
    texteEcoCirculaire: 1,
    wearType: 'womenswear',
    stockType: 'unique',
  }

  const EMPTY_DEPOSANTE_FORM = {
    id: '',
    prenom: '',
    nom: '',
    trigramme: '',
    email: '',
    telephone: '',
    adresse1: '',
    adresse2: '',
    iban: '',
    bic: '',
    banqueAdresse: '',
    modePaiement: 'virement' as 'virement' | 'bon',
    pieceIdentiteUrl: '',
  }

  export default function AdminDeposantesPage() {
    const { selectedChineuse, deposants, produits, loading } = useAdmin()
    const [rechercheDeposante, setRechercheDeposante] = useState('')
    const [showModal, setShowModal] = useState(false)
    const [formData, setFormData] = useState(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [newCategorieLabel, setNewCategorieLabel] = useState('')
    const [newCategorieIdsquare, setNewCategorieIdsquare] = useState('')
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [deposantesParticulieres, setDeposantesParticulieres] = useState<any[]>([])
    const [maxPap, setMaxPap] = useState(0)
    const [maxMaro, setMaxMaro] = useState(0)
    const [savingCapacite, setSavingCapacite] = useState(false)
    const [filterType, setFilterType] = useState<'toutes' | 'chineuses' | 'deposantes'>('toutes')
    const [showDeposanteModal, setShowDeposanteModal] = useState(false)
    const [deposanteFormData, setDeposanteFormData] = useState(EMPTY_DEPOSANTE_FORM)
    const [savingDeposante, setSavingDeposante] = useState(false)
    const [deposanteImageFile, setDeposanteImageFile] = useState<File | null>(null)
    const [deposanteImagePreview, setDeposanteImagePreview] = useState<string | null>(null)
    const [generatingTrigramme, setGeneratingTrigramme] = useState(false)

    useEffect(() => {
      getDocs(collection(db, 'deposante')).then(snap => {
        setDeposantesParticulieres(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      })
      getDocs(collection(db, 'config')).then(snap => {
        const d = snap.docs.find(d => d.id === 'capacite')
        if (d) { setMaxPap(d.data().maxPap || 0); setMaxMaro(d.data().maxMaro || 0) }
      })
    }, [])

    const saveCapacite = async () => {
      setSavingCapacite(true)
      await setDoc(doc(db, 'config', 'capacite'), { maxPap, maxMaro })
      setSavingCapacite(false)
    }
      useEffect(() => {
      const saved = sessionStorage.getItem('scrollPos')
      if (saved) {
        setTimeout(() => window.scrollTo(0, parseInt(saved)), 100)
        sessionStorage.removeItem('scrollPos')
      }
    }, [])

    const deposantesFiltreesParChineuse = useMemo(() => {
      if (!selectedChineuse) return deposants
      return deposants.filter((d: any) => d.id === selectedChineuse.uid || d.email === selectedChineuse.email)
    }, [deposants, selectedChineuse])

    const deposantesFiltrees = deposantesFiltreesParChineuse.filter((d: any) => {
      if (!rechercheDeposante) return true
      return [d.email, d.nom, d.trigramme].filter(Boolean).join(' ').toLowerCase().includes(rechercheDeposante.toLowerCase())
    })

    const openCreateModal = () => {
      setFormData(EMPTY_FORM)
      setImageFile(null)
      setImagePreview(null)
      setShowModal(true)
    }

    const openEditModal = (d: Deposante) => {
      const cats = d['Catégorie'] || []
      const catRapport = (d['Catégorie de rapport'] || [])[0] || {}

      setFormData({
        id: d.id,
        nom: d.nom || '',
        trigramme: d.trigramme || '',
        emails: Array.isArray(d.emails) ? d.emails : (d.email ? [d.email] : []),
        instagram: d.instagram || '',
        accroche: d.accroche || '',
        description: d.description || '',
        specialite: d.specialite || '',
        lien: d.lien || '',
        imageUrl: d.imageUrl || '',
        ordre: d.ordre || 0,
        categories: cats,
        categorieRapportLabel: catRapport.label || '',
        categorieRapportIdsquare: catRapport.idsquare || '',
        taux: catRapport.taux ?? 40,
        siret: d.siret || '',
        tva: d.tva || '',
        iban: d.iban || '',
        bic: d.bic || '',
        banqueAdresse: d.banqueAdresse || '',
        adresse1: d.adresse1 || '',
        adresse2: d.adresse2 || '',
        texteEcoCirculaire: (d as any).texteEcoCirculaire || 1,
        wearType: (d as any).wearType || 'womenswear',
        stockType: (d as any).stockType || 'unique',
      })
      setImageFile(null)
      setImagePreview(d.imageUrl || null)
      setShowModal(true)
    }

    const uploadToBunny = async (file: File): Promise<string> => {

      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)
      let binary = ''
      const chunkSize = 8192
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        binary += String.fromCharCode(...uint8Array.slice(i, i + chunkSize))
      }
      const base64 = btoa(binary)

      const response = await fetch('/api/detourage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, skipDetourage: true, mode: 'erased' })
      })

      if (!response.ok) throw new Error('Erreur upload')
      const data = await response.json()
      return data.maskUrl
    }

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        setImageFile(file)
        setImagePreview(URL.createObjectURL(file))
      }
    }

    const addCategorie = () => {
      if (!newCategorieLabel.trim()) return
      if (formData.categories.some(c => c.label === newCategorieLabel.trim())) return
      setFormData({
        ...formData,
        categories: [...formData.categories, { label: newCategorieLabel.trim(), idsquare: newCategorieIdsquare.trim() }]
      })
      setNewCategorieLabel('')
      setNewCategorieIdsquare('')
    }

    const removeCategorie = (label: string) => {
      setFormData({ ...formData, categories: formData.categories.filter((c) => c.label !== label) })
    }

    const updateCategorieIdsquare = (label: string, idsquare: string) => {
      setFormData({
        ...formData,
        categories: formData.categories.map(c => c.label === label ? { ...c, idsquare } : c)
      })
    }

    const handleSave = async () => {
      if (!formData.nom.trim()) {
        alert('Le nom est obligatoire')
        return
      }
      if (!formData.trigramme.trim()) {
        alert('Le trigramme est obligatoire')
        return
      }

      setSaving(true)
      try {
        let finalImageUrl = formData.imageUrl

        if (imageFile) {
          finalImageUrl = await uploadToBunny(imageFile)
        }

        const auth = getAuth()
        const token = await auth.currentUser?.getIdToken()

        const payload = {
          id: formData.id || undefined,
          nom: formData.nom.trim(),
          trigramme: formData.trigramme.trim().toUpperCase(),
          emails: formData.emails.filter(e => e.trim()),
          instagram: formData.instagram.trim(),
          accroche: formData.accroche.trim(),
          description: formData.description.trim(),
          specialite: formData.specialite.trim(),
          lien: formData.lien.trim(),
          imageUrl: finalImageUrl,
          ordre: formData.ordre,
          categories: formData.categories,
          // Infos comptables À LA RACINE
          siret: formData.siret.trim(),
          tva: formData.tva.trim(),
          iban: formData.iban.trim(),
          bic: formData.bic.trim(),
          banqueAdresse: formData.banqueAdresse.trim(),
          adresse1: formData.adresse1.trim(),
          adresse2: formData.adresse2.trim(),
          texteEcoCirculaire: formData.texteEcoCirculaire,
          wearType: formData.wearType,
          stockType: formData.stockType,
          // categorieRapport = JUSTE label + idsquare
          categorieRapport: {
            label: formData.categorieRapportLabel.trim(),
            idsquare: formData.categorieRapportIdsquare.trim(),
            taux: formData.taux,
          },
        }

        const res = await fetch('/api/chineuse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })

        const data = await res.json()

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Erreur')
        }

        const scrollPos = window.scrollY
        alert(`✅ Déposante ${data.action === 'created' ? 'créée' : 'mise à jour'} !`)
        setShowModal(false)
        window.location.reload()
        sessionStorage.setItem('scrollPos', String(scrollPos))

      } catch (err: any) {
        alert('❌ Erreur : ' + (err?.message || ''))
      } finally {
        setSaving(false)
      }
    }

    const handleDelete = async (id: string, nom: string) => {
      if (!confirm(`Supprimer la déposante "${nom}" ?`)) return

      try {
        const auth = getAuth()
        const token = await auth.currentUser?.getIdToken()

        const res = await fetch('/api/chineuse', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ id }),
        })

        const data = await res.json()

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Erreur')
        }

        alert('✅ Déposante supprimée')
        sessionStorage.setItem('scrollPos', String(window.scrollY))
        window.location.reload()

      } catch (err: any) {
        alert('❌ Erreur : ' + (err?.message || ''))
      }
    }

    const handleMigration = async () => {
      if (!confirm('Lancer la migration des infos comptables vers la racine des documents ?')) return
      try {
        const auth = getAuth()
        const token = await auth.currentUser?.getIdToken()
        const res = await fetch('/api/migrate-chineuse', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (data.success) {
          alert(`✅ ${data.message}\n\nErreurs: ${data.results.errors.length > 0 ? data.results.errors.join('\n') : 'Aucune'}`)
          window.location.reload()
        } else {
          alert('❌ Erreur: ' + data.error)
        }
      } catch (err: any) {
        alert('❌ Erreur: ' + err.message)
      }
    }

    // =====================
    // DEPOSANTE HANDLERS
    // =====================
    const openCreateDeposanteModal = () => {
      setDeposanteFormData(EMPTY_DEPOSANTE_FORM)
      setDeposanteImageFile(null)
      setDeposanteImagePreview(null)
      setShowDeposanteModal(true)
    }

    const openEditDeposanteModal = (d: any) => {
      setDeposanteFormData({
        id: d.id || '',
        prenom: d.prenom || '',
        nom: d.nom || '',
        trigramme: d.trigramme || '',
        email: d.email || '',
        telephone: d.telephone || '',
        adresse1: d.adresse1 || '',
        adresse2: d.adresse2 || '',
        iban: d.iban || '',
        bic: d.bic || '',
        banqueAdresse: d.banqueAdresse || '',
        modePaiement: d.modePaiement || 'virement',
        pieceIdentiteUrl: d.pieceIdentiteUrl || '',
      })
      setDeposanteImageFile(null)
      setDeposanteImagePreview(d.pieceIdentiteUrl || null)
      setShowDeposanteModal(true)
    }

    const handleDeposanteImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        setDeposanteImageFile(file)
        setDeposanteImagePreview(URL.createObjectURL(file))
      }
    }

    const handleAutoGenerateTrigramme = async () => {
      if (!deposanteFormData.prenom && !deposanteFormData.nom) return
      setGeneratingTrigramme(true)
      const base = generateTrigramme(deposanteFormData.prenom, deposanteFormData.nom)
      const unique = await findUniqueTrigramme(base, deposanteFormData.id || undefined)
      setDeposanteFormData({ ...deposanteFormData, trigramme: unique })
      setGeneratingTrigramme(false)
    }

    const handleSaveDeposante = async () => {
      if (!deposanteFormData.prenom.trim() || !deposanteFormData.nom.trim()) {
        alert('Prénom et nom sont obligatoires')
        return
      }

      setSavingDeposante(true)
      try {
        let finalPieceIdentiteUrl = deposanteFormData.pieceIdentiteUrl

        // Upload piece identite if new file selected
        if (deposanteImageFile) {
          const auth = getAuth()
          const token = await auth.currentUser?.getIdToken()
          const ext = deposanteImageFile.name.split('.').pop()
          const uid = deposanteFormData.id || crypto.randomUUID()
          const filename = `pieces-identite/${uid}.${ext}`
          const res = await fetch(`/api/bunny-upload?filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(deposanteImageFile.type)}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: deposanteImageFile,
          })
          const data = await res.json()
          if (data.url) finalPieceIdentiteUrl = data.url
        }

        const docId = deposanteFormData.id || crypto.randomUUID()
        const payload: any = {
          prenom: deposanteFormData.prenom.trim(),
          nom: deposanteFormData.nom.trim(),
          trigramme: deposanteFormData.trigramme.trim().toUpperCase(),
          email: deposanteFormData.email.trim(),
          telephone: deposanteFormData.telephone.trim(),
          adresse1: deposanteFormData.adresse1.trim(),
          adresse2: deposanteFormData.adresse2.trim(),
          iban: deposanteFormData.iban.trim(),
          bic: deposanteFormData.bic.trim(),
          banqueAdresse: deposanteFormData.banqueAdresse.trim(),
          modePaiement: deposanteFormData.modePaiement,
          pieceIdentiteUrl: finalPieceIdentiteUrl,
        }

        if (!deposanteFormData.id) {
          payload.createdAt = serverTimestamp()
        }

        await setDoc(doc(db, 'deposante', docId), payload, { merge: true })

        alert(`✅ Déposante ${deposanteFormData.id ? 'mise à jour' : 'créée'} !`)
        setShowDeposanteModal(false)

        // Re-fetch deposantes
        const snap = await getDocs(collection(db, 'deposante'))
        setDeposantesParticulieres(snap.docs.map(d => ({ id: d.id, ...d.data() })))

      } catch (err: any) {
        alert('❌ Erreur : ' + (err?.message || ''))
      } finally {
        setSavingDeposante(false)
      }
    }

    const handleDeleteDeposante = async (id: string, nom: string) => {
      if (!confirm(`Supprimer la déposante "${nom}" ?`)) return

      try {
        await deleteDoc(doc(db, 'deposante', id))
        alert('✅ Déposante supprimée')

        // Re-fetch deposantes
        const snap = await getDocs(collection(db, 'deposante'))
        setDeposantesParticulieres(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err: any) {
        alert('❌ Erreur : ' + (err?.message || ''))
      }
    }

    // =====================
    // UNIFIED LIST
    // =====================
    const unifiedList = useMemo(() => {
      const chineuses = deposantesFiltreesParChineuse.map((d: any) => ({ ...d, _type: 'chineuse' as const }))
      const deposantes = deposantesParticulieres.map((d: any) => ({ ...d, _type: 'deposante' as const }))

      let combined = [...chineuses, ...deposantes]

      // Apply filter
      if (filterType === 'chineuses') combined = chineuses
      if (filterType === 'deposantes') combined = deposantes

      // Apply search
      if (rechercheDeposante) {
        combined = combined.filter((d: any) => {
          const searchStr = [d.email, d.nom, d.prenom, d.trigramme].filter(Boolean).join(' ').toLowerCase()
          return searchStr.includes(rechercheDeposante.toLowerCase())
        })
      }

      // Sort alphabetically by nom
      return combined.sort((a: any, b: any) => {
        const nomA = (a.nom || '').toLowerCase()
        const nomB = (b.nom || '').toLowerCase()
        return nomA.localeCompare(nomB)
      })
    }, [deposantesFiltreesParChineuse, deposantesParticulieres, filterType, rechercheDeposante])

    // Helper pour afficher si un champ est vide
    const fieldStatus = (value: string | undefined) => {
      if (!value || value.trim() === '') {
        return <span className="text-red-400 text-xs ml-1">⚠️ vide</span>
      }
      return <span className="text-green-500 text-xs ml-1">✓</span>
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]"></div>
        </div>
      )
    }

    return (
      <>
        <div className="mb-8 lg:grid lg:grid-cols-3 lg:gap-6">
          <div className="lg:col-span-2">
            <PlanningCalendar
              mode="restock"
              participants={deposants.map((d: any) => ({
                nom: (d.nom || d.trigramme || '').toUpperCase(),
                type: 'chineuse' as const
              }))}
              userType="admin"
            />

            <div className="mt-6 bg-white rounded-xl border p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Capacité restocks</p>
              <div className="flex items-end gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Max PAP</label>
                  <input
                    type="number"
                    value={maxPap}
                    onChange={(e) => setMaxPap(parseInt(e.target.value) || 0)}
                    className="w-24 border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max MARO</label>
                  <input
                    type="number"
                    value={maxMaro}
                    onChange={(e) => setMaxMaro(parseInt(e.target.value) || 0)}
                    className="w-24 border rounded px-3 py-2"
                  />
                </div>
                <button
                  onClick={saveCapacite}
                  disabled={savingCapacite}
                  className="px-4 py-2 bg-[#22209C] text-white rounded hover:opacity-90 disabled:opacity-50"
                >
                  {savingCapacite ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </div>

          {/* STATS RESTOCKS */}
          <div className="mt-6 lg:mt-0">
            <div className="bg-white rounded-xl border p-2 sticky top-20">
              <div>
                {[...deposants]
                  .map((d: any) => {
                    const nbProduits = produits.filter((p: any) => p.chineur === d.email || p.chineurUid === d.id).length
                    const nbEnVente = produits.filter((p: any) => (p.chineur === d.email || p.chineurUid === d.id) && !p.vendu).length
                    const dernierProduit = produits
                      .filter((p: any) => p.chineur === d.email || p.chineurUid === d.id)
                      .sort((a: any, b: any) => {
                        const ta = a.createdAt?.toDate?.()?.getTime?.() || 0
                        const tb = b.createdAt?.toDate?.()?.getTime?.() || 0
                        return tb - ta
                      })[0]
                    const dernierRestock = dernierProduit?.createdAt?.toDate?.()
                    const joursDepuis = dernierRestock
                      ? Math.floor((Date.now() - dernierRestock.getTime()) / (1000 * 60 * 60 * 24))
                      : null
                    return { d, nbProduits, nbEnVente, joursDepuis, dernierRestock }
                  })
                  .sort((a, b) => (b.joursDepuis ?? 9999) - (a.joursDepuis ?? 9999) || b.nbProduits - a.nbProduits)
                  .map(({ d, nbProduits, nbEnVente, joursDepuis, dernierRestock }) => (
                    <div key={d.id} className={`flex items-center justify-between py-0.5 text-xs ${nbProduits < 30 || joursDepuis === null || joursDepuis > 30 ? 'text-red-500' : 'text-gray-700'}`}>
                      <span className="font-bold truncate mr-2">{(d.nom || d.trigramme || '').toUpperCase()}</span>
                      <span className="whitespace-nowrap flex-shrink-0">
                        {nbProduits} art. · {dernierRestock ? dernierRestock.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'jamais'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* FILTER BAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            {(['toutes', 'chineuses', 'deposantes'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-4 py-2 text-sm font-medium rounded transition-colors ${
                  filterType === type
                    ? 'bg-black text-white'
                    : 'bg-white border text-gray-700 hover:bg-gray-50'
                }`}
              >
                {type === 'toutes' ? 'Toutes' : type === 'chineuses' ? 'Chineuses' : 'Déposantes'}
              </button>
            ))}
          </div>

          {!selectedChineuse && (
            <div className="flex-1 relative w-full sm:w-auto">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={rechercheDeposante}
                onChange={(e) => setRechercheDeposante(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-10 pr-4 py-2 border rounded text-sm"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2 bg-[#22209C] text-white rounded hover:opacity-90"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Chineuse</span>
            </button>
            <button
              onClick={openCreateDeposanteModal}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded hover:opacity-90"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Déposante</span>
            </button>
          </div>
        </div>

        {/* UNIFIED LIST */}
        <div className="space-y-4">
          {unifiedList.map((d: any) => {
            const isChineuse = d._type === 'chineuse'
            const rawCats = d?.['Catégorie'] ?? []
            const cats = Array.isArray(rawCats) ? rawCats.map((c: any) => c?.label || '').filter(Boolean) : []

            const nbProduits = isChineuse
              ? produits.filter((p: any) => p.chineur === d.email || p.chineurUid === d.id).length
              : produits.filter((p: any) => p.trigramme === d.trigramme).length
            const nbVendues = isChineuse
              ? produits.filter((p: any) => (p.chineur === d.email || p.chineurUid === d.id) && p.vendu).length
              : produits.filter((p: any) => p.trigramme === d.trigramme && p.vendu).length
            const caTotal = isChineuse
              ? produits.filter((p: any) => (p.chineur === d.email || p.chineurUid === d.id) && p.vendu).reduce((sum: number, p: any) => sum + (p.prixVenteReel ?? p.prix ?? 0), 0)
              : produits.filter((p: any) => p.trigramme === d.trigramme && p.vendu).reduce((sum: number, p: any) => sum + (p.prixVenteReel ?? p.prix ?? 0), 0)

            const accroche = d?.accroche || ''
            const description = d?.description || ''

            const champsManquants = isChineuse
              ? [!d.email, !d.instagram, !d.accroche, !d.description, !d.specialite, !d.lien, !d.imageUrl, !d.siret, !d.iban].filter(Boolean).length
              : [!d.email, !d.iban, !d.contratSigne].filter(Boolean).length

            const borderClass = isChineuse ? 'border-[#22209C]' : 'border-orange-300'
            const avatarBgClass = isChineuse ? 'bg-[#22209C]' : 'bg-orange-500'
            const accentColor = isChineuse ? 'text-[#22209C]' : 'text-orange-500'
            const caBgClass = isChineuse ? 'bg-blue-50' : 'bg-orange-50'

            return (
              <div key={`${d._type}-${d.id}`} className={`bg-white border ${borderClass} rounded-lg overflow-hidden`}>
                <div className="p-4 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {d.imageUrl ? (
                      <img src={d.imageUrl} alt={d.nom} className="w-14 h-14 rounded-lg object-cover" />
                    ) : (
                      <div className={`w-14 h-14 ${avatarBgClass} text-white rounded-lg flex items-center justify-center font-bold text-lg flex-shrink-0`}>
                        {d.trigramme || '?'}
                      </div>
                    )}

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-lg">
                          {isChineuse
                            ? (d.nom || '').toUpperCase()
                            : ((d.prenom || '') + ' ' + (d.nom || '')).toUpperCase().trim()}
                        </p>
                        {champsManquants > 0 && (
                          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                            {champsManquants} champ{champsManquants > 1 ? 's' : ''} manquant{champsManquants > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {isChineuse && Array.isArray(d.emails) && d.emails.length > 0
                          ? d.emails.join(', ')
                          : (d.email || '—')}
                      </p>
                      {accroche && <p className={`text-sm ${accentColor} font-medium mt-1 italic`}>"{accroche}"</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="hidden md:flex items-center gap-4 text-sm mr-4">
                      <div className="text-center px-3 py-2 bg-gray-50 rounded-lg">
                        <p className="text-gray-500 text-xs">Produits</p>
                        <p className="font-bold text-lg">{nbProduits}</p>
                      </div>
                      <div className="text-center px-3 py-2 bg-green-50 rounded-lg">
                        <p className="text-gray-500 text-xs">Ventes</p>
                        <p className="font-bold text-lg text-green-600">{nbVendues}</p>
                      </div>
                      <div className={`text-center px-3 py-2 ${caBgClass} rounded-lg`}>
                        <p className="text-gray-500 text-xs">CA</p>
                        <p className={`font-bold text-lg ${accentColor}`}>{caTotal.toFixed(0)} €</p>
                      </div>
                    </div>

                    <button
                      onClick={() => isChineuse ? openEditModal(d) : openEditDeposanteModal(d)}
                      className="p-2 text-gray-500 hover:text-[#22209C]"
                      title="Modifier"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => isChineuse ? handleDelete(d.id, d.nom) : handleDeleteDeposante(d.id, d.nom)}
                      className="p-2 text-red-400 hover:text-red-600"
                      title="Supprimer"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {description && (
                  <div className="px-4 pb-3">
                    <p className="text-sm text-gray-600 line-clamp-2">{description}</p>
                  </div>
                )}

                {cats.length > 0 && (
                  <div className="px-4 py-3 bg-gray-50 border-t">
                    <div className="flex flex-wrap gap-2">
                      {cats.map((cat: string, idx: number) => (
                        <span
                          key={idx}
                          className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                            isChineuse ? 'bg-[#22209C]/10 text-[#22209C]' : 'bg-orange-100 text-orange-600'
                          }`}
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {!unifiedList.length && <p className="text-center text-gray-400 py-8">Aucun résultat</p>}
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
                <h2 className="text-lg font-bold">{formData.id ? 'Modifier la' : 'Nouvelle'} déposante</h2>
                <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 space-y-6">
                {/* INFOS GÉNÉRALES */}
                <div>
                  
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Informations générales</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Nom * {fieldStatus(formData.nom)}
                      </label>
                      <input
                        type="text"
                        value={formData.nom}
                        onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                        placeholder="Ines Pineau"
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Trigramme * {fieldStatus(formData.trigramme)}
                      </label>
                      <input
                        type="text"
                        value={formData.trigramme}
                        onChange={(e) => setFormData({ ...formData, trigramme: e.target.value.toUpperCase() })}
                        placeholder="IP"
                        maxLength={4}
                        className="w-full border rounded px-3 py-2 uppercase"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium mb-1">
                      Emails {formData.emails.length === 0 && <span className="text-red-400 text-xs ml-1">⚠️ aucun</span>}
                      {formData.emails.length > 0 && <span className="text-green-500 text-xs ml-1">✓ {formData.emails.length}</span>}
                    </label>
                    <div className="space-y-2">
                      {formData.emails.map((email, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => {
                              const newEmails = [...formData.emails]
                              newEmails[idx] = e.target.value
                              setFormData({ ...formData, emails: newEmails })
                            }}
                            placeholder="contact@example.com"
                            className="flex-1 border rounded px-3 py-2"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, emails: formData.emails.filter((_, i) => i !== idx) })}
                            className="p-2 text-red-400 hover:text-red-600"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, emails: [...formData.emails, ''] })}
                        className="flex items-center gap-2 text-sm text-[#22209C] hover:underline"
                      >
                        <Plus size={16} /> Ajouter un email
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium mb-1">
                      Instagram {fieldStatus(formData.instagram)}
                    </label>
                    <input
                      type="url"
                      value={formData.instagram}
                      onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                      placeholder="https://instagram.com/..."
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium mb-1">
                      Accroche {fieldStatus(formData.accroche)}
                    </label>
                    <input
                      type="text"
                      value={formData.accroche}
                      onChange={(e) => setFormData({ ...formData, accroche: e.target.value })}
                      placeholder="BIJOUX UPCYCLÉS FAITS MAIN À PARIS"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium mb-1">
                      Description {fieldStatus(formData.description)}
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Présentation de la marque..."
                      rows={3}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium mb-1">Texte économie circulaire</label>
                    <select
                      value={formData.texteEcoCirculaire}
                      onChange={(e) => setFormData({ ...formData, texteEcoCirculaire: parseInt(e.target.value) })}
                      className="w-full border rounded px-3 py-2 text-sm"
                    >
                      <option value={1}>Seconde main (vintage)</option>
                      <option value={2}>Upcycling</option>
                      <option value={3}>Régénéré</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Collection</label>
                      <select
                        value={formData.wearType}
                        onChange={(e) => setFormData({ ...formData, wearType: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        <option value="womenswear">Womenswear</option>
                        <option value="menswear">Menswear</option>
                        <option value="unisex">Unisex</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Type de stock</label>
                      <select
                        value={formData.stockType}
                        onChange={(e) => setFormData({ ...formData, stockType: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        <option value="unique">Pièce unique</option>
                        <option value="smallBatch">Petite série</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Spécialité {fieldStatus(formData.specialite)}
                      </label>
                      <input
                        type="text"
                        value={formData.specialite}
                        onChange={(e) => setFormData({ ...formData, specialite: e.target.value })}
                        placeholder="Bijoux upcyclés"
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Site web {fieldStatus(formData.lien)}
                      </label>
                      <input
                        type="url"
                        value={formData.lien}
                        onChange={(e) => setFormData({ ...formData, lien: e.target.value })}
                        placeholder="https://..."
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Photo {fieldStatus(formData.imageUrl)}
                      </label>
                      <div className="flex items-center gap-4">
                        {imagePreview && (
                          <img src={imagePreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
                        )}
                        <label className="flex-1 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:bg-gray-50">
                          <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                          <p className="text-xs text-gray-500">Cliquez pour ajouter</p>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Ordre d'affichage</label>
                      <input
                        type="number"
                        value={formData.ordre}
                        onChange={(e) => setFormData({ ...formData, ordre: parseInt(e.target.value) || 0 })}
                        className="w-full border rounded px-3 py-2"
                      />
                    </div>
                  </div>
                </div>

                {/* CATÉGORIES */}
                <div className="border-t pt-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                    Catégories produits 
                    {formData.categories.length === 0 && <span className="text-red-400 text-xs ml-1">⚠️ aucune</span>}
                    {formData.categories.length > 0 && <span className="text-green-500 text-xs ml-1">✓ {formData.categories.length}</span>}
                  </h3>
                  
                  <div className="space-y-2 mb-4">
                    {formData.categories.map((cat, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                        <span className="flex-1 text-sm font-medium">{cat.label}</span>
                        <input
                          type="text"
                          value={cat.idsquare}
                          onChange={(e) => updateCategorieIdsquare(cat.label, e.target.value)}
                          placeholder="ID Square"
                          className={`w-48 border rounded px-2 py-1 text-xs font-mono ${!cat.idsquare ? 'border-orange-300 bg-orange-50' : ''}`}
                        />
                        {!cat.idsquare && <span className="text-orange-400 text-xs">⚠️</span>}
                        {cat.idsquare && <span className="text-green-500 text-xs">✓</span>}
                        <button onClick={() => removeCategorie(cat.label)} className="p-1 text-red-400 hover:text-red-600">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCategorieLabel}
                      onChange={(e) => setNewCategorieLabel(e.target.value)}
                      placeholder="IP - Nouvelle catégorie"
                      className="flex-1 border rounded px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      value={newCategorieIdsquare}
                      onChange={(e) => setNewCategorieIdsquare(e.target.value)}
                      placeholder="ID Square"
                      className="w-48 border rounded px-3 py-2 text-sm font-mono"
                    />
                    <button onClick={addCategorie} className="px-3 py-2 bg-gray-100 rounded hover:bg-gray-200">
                      <Plus size={18} />
                    </button>
                  </div>
                </div>

                {/* CATÉGORIE DE RAPPORT (SQUARE) */}
                <div className="border-t pt-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                    Catégorie de rapport (Square)
                    {fieldStatus(formData.categorieRapportLabel)}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Label</label>
                      <input
                        type="text"
                        value={formData.categorieRapportLabel}
                        onChange={(e) => setFormData({ ...formData, categorieRapportLabel: e.target.value })}
                        placeholder="INES PINEAU"
                        className={`w-full border rounded px-3 py-2 text-sm ${!formData.categorieRapportLabel ? 'border-orange-300 bg-orange-50' : ''}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">ID Square</label>
                      <input
                        type="text"
                        value={formData.categorieRapportIdsquare}
                        onChange={(e) => setFormData({ ...formData, categorieRapportIdsquare: e.target.value })}
                        placeholder="77ST6DK45WNHD6KVH2OTGX5O"
                        className={`w-full border rounded px-3 py-2 text-sm font-mono ${!formData.categorieRapportIdsquare ? 'border-orange-300 bg-orange-50' : ''}`}
                      />
                    </div>
                  </div>
                </div>

                {/* INFOS COMPTABLES */}
                <div className="border-t pt-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Informations comptables</h3>
                  
                  <div className="mb-4">
                    <label className="block text-xs text-gray-500 mb-1">Paramètre</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={formData.taux}
                        onChange={(e) => {
                          const val = e.target.value
                          setFormData({ ...formData, taux: val === '' ? 40 : parseInt(val) })
                        }}
                        min={0}
                        max={100}
                        className="w-24 border rounded px-3 py-2 text-sm"
                      />
                      <span className="text-sm text-gray-500">%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        SIRET {fieldStatus(formData.siret)}
                      </label>
                      <input
                        type="text"
                        value={formData.siret}
                        onChange={(e) => setFormData({ ...formData, siret: e.target.value })}
                        placeholder="123 456 789 00012"
                        className={`w-full border rounded px-3 py-2 text-sm ${!formData.siret ? 'border-orange-300 bg-orange-50' : ''}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        N° TVA {fieldStatus(formData.tva)}
                      </label>
                      <input
                        type="text"
                        value={formData.tva}
                        onChange={(e) => setFormData({ ...formData, tva: e.target.value })}
                        placeholder="FR12345678901"
                        className={`w-full border rounded px-3 py-2 text-sm ${!formData.tva ? 'border-orange-300 bg-orange-50' : ''}`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        IBAN {fieldStatus(formData.iban)}
                      </label>
                      <input
                        type="text"
                        value={formData.iban}
                        onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                        placeholder="FR76 1234 5678 9012 3456 7890 123"
                        className={`w-full border rounded px-3 py-2 text-sm font-mono ${!formData.iban ? 'border-orange-300 bg-orange-50' : ''}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        BIC {fieldStatus(formData.bic)}
                      </label>
                      <input
                        type="text"
                        value={formData.bic}
                        onChange={(e) => setFormData({ ...formData, bic: e.target.value })}
                        placeholder="BNPAFRPP"
                        className={`w-full border rounded px-3 py-2 text-sm font-mono ${!formData.bic ? 'border-orange-300 bg-orange-50' : ''}`}
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-xs text-gray-500 mb-1">
                      Adresse banque {fieldStatus(formData.banqueAdresse)}
                    </label>
                    <input
                      type="text"
                      value={formData.banqueAdresse}
                      onChange={(e) => setFormData({ ...formData, banqueAdresse: e.target.value })}
                      placeholder="BNP Paribas - 16 Boulevard des Italiens, 75009 Paris"
                      className={`w-full border rounded px-3 py-2 text-sm ${!formData.banqueAdresse ? 'border-orange-300 bg-orange-50' : ''}`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Adresse ligne 1 {fieldStatus(formData.adresse1)}
                      </label>
                      <input
                        type="text"
                        value={formData.adresse1}
                        onChange={(e) => setFormData({ ...formData, adresse1: e.target.value })}
                        placeholder="123 Rue de la Paix"
                        className={`w-full border rounded px-3 py-2 text-sm ${!formData.adresse1 ? 'border-orange-300 bg-orange-50' : ''}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Adresse ligne 2 {fieldStatus(formData.adresse2)}
                      </label>
                      <input
                        type="text"
                        value={formData.adresse2}
                        onChange={(e) => setFormData({ ...formData, adresse2: e.target.value })}
                        placeholder="75002 Paris"
                        className={`w-full border rounded px-3 py-2 text-sm ${!formData.adresse2 ? 'border-orange-300 bg-orange-50' : ''}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded hover:bg-gray-50">
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-[#22209C] text-white rounded hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Enregistrement...' : formData.id ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DEPOSANTE MODAL */}
        {showDeposanteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
                <h2 className="text-lg font-bold">{deposanteFormData.id ? 'Modifier la' : 'Nouvelle'} déposante</h2>
                <button onClick={() => setShowDeposanteModal(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* IDENTITÉ */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Prénom *</label>
                    <input
                      type="text"
                      value={deposanteFormData.prenom}
                      onChange={(e) => setDeposanteFormData({ ...deposanteFormData, prenom: e.target.value })}
                      placeholder="Marie"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Nom *</label>
                    <input
                      type="text"
                      value={deposanteFormData.nom}
                      onChange={(e) => setDeposanteFormData({ ...deposanteFormData, nom: e.target.value })}
                      placeholder="Dupont"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Trigramme</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={deposanteFormData.trigramme}
                      onChange={(e) => setDeposanteFormData({ ...deposanteFormData, trigramme: e.target.value.toUpperCase() })}
                      placeholder="MDU"
                      maxLength={5}
                      className="flex-1 border rounded px-3 py-2 uppercase"
                    />
                    <button
                      type="button"
                      onClick={handleAutoGenerateTrigramme}
                      disabled={generatingTrigramme}
                      className="px-3 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                    >
                      {generatingTrigramme ? '...' : 'Auto-générer'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      value={deposanteFormData.email}
                      onChange={(e) => setDeposanteFormData({ ...deposanteFormData, email: e.target.value })}
                      placeholder="marie@example.com"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Téléphone</label>
                    <input
                      type="text"
                      value={deposanteFormData.telephone}
                      onChange={(e) => setDeposanteFormData({ ...deposanteFormData, telephone: e.target.value })}
                      placeholder="+33 6 xx xx xx xx"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Adresse ligne 1</label>
                    <input
                      type="text"
                      value={deposanteFormData.adresse1}
                      onChange={(e) => setDeposanteFormData({ ...deposanteFormData, adresse1: e.target.value })}
                      placeholder="123 Rue de la Paix"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Adresse ligne 2</label>
                    <input
                      type="text"
                      value={deposanteFormData.adresse2}
                      onChange={(e) => setDeposanteFormData({ ...deposanteFormData, adresse2: e.target.value })}
                      placeholder="75002 Paris"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>

                {/* COORDONNÉES BANCAIRES */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Coordonnées bancaires</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">IBAN</label>
                      <input
                        type="text"
                        value={deposanteFormData.iban}
                        onChange={(e) => setDeposanteFormData({ ...deposanteFormData, iban: e.target.value })}
                        placeholder="FR76 xxxx xxxx xxxx xxxx xxxx xxx"
                        className="w-full border rounded px-3 py-2 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">BIC</label>
                      <input
                        type="text"
                        value={deposanteFormData.bic}
                        onChange={(e) => setDeposanteFormData({ ...deposanteFormData, bic: e.target.value })}
                        placeholder="BNPAFRPP"
                        className="w-full border rounded px-3 py-2 font-mono text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium mb-1">Adresse banque</label>
                    <input
                      type="text"
                      value={deposanteFormData.banqueAdresse}
                      onChange={(e) => setDeposanteFormData({ ...deposanteFormData, banqueAdresse: e.target.value })}
                      placeholder="BNP Paribas - 16 Boulevard des Italiens, 75009 Paris"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>

                {/* MODE PAIEMENT */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Mode de paiement</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setDeposanteFormData({ ...deposanteFormData, modePaiement: 'virement' })}
                      className={`px-4 py-2 text-sm font-medium rounded border ${
                        deposanteFormData.modePaiement === 'virement'
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black border-gray-300'
                      }`}
                    >
                      VIREMENT
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeposanteFormData({ ...deposanteFormData, modePaiement: 'bon' })}
                      className={`px-4 py-2 text-sm font-medium rounded border ${
                        deposanteFormData.modePaiement === 'bon'
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black border-gray-300'
                      }`}
                    >
                      BON D'ACHAT
                    </button>
                  </div>
                </div>

                {/* PIÈCE D'IDENTITÉ */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Pièce d'identité</h3>
                  <div className="flex items-center gap-4">
                    {deposanteImagePreview && (
                      <div className="w-20 h-14 border rounded overflow-hidden">
                        <img src={deposanteImagePreview} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <label className="flex-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50">
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={handleDeposanteImageChange}
                        className="hidden"
                      />
                      <p className="text-sm text-gray-500">
                        {deposanteImagePreview ? 'Remplacer le document' : 'Cliquez pour ajouter'}
                      </p>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 p-4 border-t sticky bottom-0 bg-white">
                <button onClick={() => setShowDeposanteModal(false)} className="px-4 py-2 border rounded hover:bg-gray-50">
                  Annuler
                </button>
                <button
                  onClick={handleSaveDeposante}
                  disabled={savingDeposante}
                  className="px-4 py-2 bg-orange-500 text-white rounded hover:opacity-90 disabled:opacity-50"
                >
                  {savingDeposante ? 'Enregistrement...' : deposanteFormData.id ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </div>
          </div>
        )}
        </>
    )
  }