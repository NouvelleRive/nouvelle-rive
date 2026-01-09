// components/SalesList.tsx
'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx'
import FilterBox from '@/components/FilterBox'
import { 
  Search, X, Download, FileSpreadsheet, RefreshCw, 
  Plus, Trash2, Link, CheckCircle, AlertCircle, 
  CheckSquare, Square, Upload, ChevronDown, ChevronUp, Pencil
} from 'lucide-react'

// =====================
// TYPES
// =====================
export interface Vente {
  id: string
  produitId?: string | null
  nom?: string
  description?: string
  sku?: string | null
  categorie?: any
  marque?: string | null
  trigramme?: string | null
  chineur?: string
  chineurUid?: string
  prix?: number
  prixInitial?: number | null
  prixVenteReel?: number
  dateVente?: Timestamp | string | null
  remarque?: string | null
  source?: string
  isAttribue?: boolean
  vendu?: boolean
}

export interface ChineuseMeta {
  nom?: string
  commissionHT?: number
  taux?: number
  siret?: string
  adresse1?: string
  adresse2?: string
  tva?: string
  iban?: string
  bic?: string
  banqueAdresse?: string
  codeChineuse?: string
  code?: string
}

interface SalesListProps {
  titre: string
  ventes: Vente[]
  chineuse?: ChineuseMeta | null
  deposants?: any[]
  chineuses?: Array<{ trigramme: string; nom: string }> // Liste des chineuses pour le filtre
  userEmail?: string
  isAdmin?: boolean
  loading?: boolean
  // Callbacks admin
  onAttribuer?: (vente: Vente) => void
  onModifierPrix?: (vente: Vente) => void  
  onSupprimer?: (vente: Vente) => void
  onSupprimerBatch?: (ids: string[]) => void
  onAjouterVente?: () => void
  // Sync
  onSync?: (startDate: string, endDate: string) => Promise<void>
  syncLoading?: boolean
  // Import Excel (admin)
  onImportExcel?: (rows: any[]) => Promise<void>
  importLoading?: boolean
  // Refresh
  onRefresh?: () => void
}

const PRIMARY = '#22209C'

// =====================
// COMPONENT
// =====================
export default function SalesList({
  titre,
  ventes,
  chineuse,
  deposants = [],
  chineuses = [],
  userEmail,
  isAdmin = false,
  loading = false,
  onAttribuer,
  onModifierPrix, 
  onSupprimer,
  onSupprimerBatch,
  onAjouterVente,
  onSync,
  syncLoading = false,
  onImportExcel,
  importLoading = false,
  onRefresh,
}: SalesListProps) {
  // Filtres
  const [recherche, setRecherche] = useState('')
  const [filtreMois, setFiltreMois] = useState('')
  const [filtreChineuse, setFiltreChineuse] = useState('')
  const [filtrePrix, setFiltrePrix] = useState('')
  const [filtreStatut, setFiltreStatut] = useState<'all' | 'attribue' | 'non-attribue'>('all')
  const [tri, setTri] = useState<'date-desc' | 'date-asc' | 'alpha' | 'prix-asc' | 'prix-desc'>('date-desc')

  // Sélection (admin)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Infinite scroll
  const [visibleCount, setVisibleCount] = useState(20)
  const loaderRef = useRef<HTMLDivElement>(null)

  // Export
  const [showMonthSelect, setShowMonthSelect] = useState(false)

  // Import Excel drag & drop
  const [isDragging, setIsDragging] = useState(false)

  // =====================
  // HELPERS
  // =====================

  const getDateFromVente = (v: Vente): Date => {
    if (v.dateVente && typeof (v.dateVente as any).toDate === 'function') {
      return (v.dateVente as any).toDate()
    }
    if (typeof v.dateVente === 'string') return new Date(v.dateVente)
    return new Date()
  }

  const formatDateVente = (v: Vente): string => {
    const d = getDateFromVente(v)
    return isNaN(d.getTime()) ? '—' : format(d, 'dd/MM/yyyy')
  }

  const getPrix = (v: Vente): number => {
    return typeof v.prixVenteReel === 'number' ? v.prixVenteReel : (v.prix || 0)
  }

  const getCategorie = (v: Vente): string => {
    return typeof v.categorie === 'object' ? v.categorie?.label : (v.categorie || '')
  }

  // Extraire le trigramme d'une vente (depuis trigramme, sku, ou catégorie)
  const getTrigrammeFromVente = (v: Vente): string => {
    // 1. Trigramme direct
    if (v.trigramme) return v.trigramme.toUpperCase()
    
    // 2. Depuis le SKU (ex: "AGE25" -> "AGE")
    if (v.sku) {
      const match = v.sku.match(/^([A-Za-z]+)/i)
      if (match) return match[1].toUpperCase()
    }
    
    // 3. Depuis la catégorie (ex: "AGE - Jupe" -> "AGE")
    const cat = getCategorie(v)
    if (cat && cat.includes(' - ')) {
      return cat.split(' - ')[0].trim().toUpperCase()
    }
    
    return ''
  }

  // =====================
  // MOIS DISPONIBLES
  // =====================
  const moisDisponibles = useMemo(() => {
    const set = new Set<string>()
    ventes.forEach(v => {
      const d = getDateFromVente(v)
      if (!isNaN(d.getTime())) {
        set.add(`${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`)
      }
    })
    return Array.from(set)
      .map(val => {
        const [m, y] = val.split('-').map(Number)
        const d = new Date(y, m - 1)
        return { value: val, label: format(d, 'MMMM yyyy', { locale: fr }) }
      })
      .sort((a, b) => {
        const [mA, yA] = a.value.split('-').map(Number)
        const [mB, yB] = b.value.split('-').map(Number)
        return new Date(yB, mB - 1).getTime() - new Date(yA, mA - 1).getTime()
      })
  }, [ventes])

  // =====================
  // CHINEUSES DISPONIBLES (extraites des ventes)
  // =====================
  const chineusesDisponibles = useMemo(() => {
    const map = new Map<string, string>() // trigramme -> nom
    
    // D'abord depuis la liste passée en props
    chineuses.forEach(c => {
      if (c.trigramme) {
        map.set(c.trigramme.toUpperCase(), c.nom || c.trigramme)
      }
    })
    
    // Puis depuis les ventes (pour capter celles non listées)
    ventes.forEach(v => {
      const tri = getTrigrammeFromVente(v)
      if (tri && !map.has(tri)) {
        map.set(tri, tri) // Utilise le trigramme comme nom par défaut
      }
    })
    
    return Array.from(map.entries())
      .map(([trigramme, nom]) => ({ trigramme, nom }))
      .sort((a, b) => a.trigramme.localeCompare(b.trigramme))
  }, [ventes, chineuses])

  // =====================
  // DERNIÈRE VENTE (pour sync)
  // =====================
  const derniereVenteDate = useMemo(() => {
    if (ventes.length === 0) return null
    const dates = ventes.map(v => getDateFromVente(v)).filter(d => !isNaN(d.getTime()))
    if (dates.length === 0) return null
    return new Date(Math.max(...dates.map(d => d.getTime())))
  }, [ventes])

  // =====================
  // FILTRAGE
  // =====================
  const ventesFiltrees = useMemo(() => {
    let result = [...ventes]

    // Recherche
    if (recherche.trim()) {
      const term = recherche.toLowerCase()
      result = result.filter(v =>
        v.nom?.toLowerCase().includes(term) ||
        v.sku?.toLowerCase().includes(term) ||
        v.remarque?.toLowerCase().includes(term) ||
        v.trigramme?.toLowerCase().includes(term) ||
        v.description?.toLowerCase().includes(term)
      )
    }

    // Mois
    if (filtreMois) {
      result = result.filter(v => {
        const d = getDateFromVente(v)
        const key = isNaN(d.getTime()) ? '' : `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
        return key === filtreMois
      })
    }

    // Chineuse (par trigramme)
    if (filtreChineuse) {
      result = result.filter(v => {
        const tri = getTrigrammeFromVente(v)
        return tri === filtreChineuse.toUpperCase()
      })
    }

    // Prix exact
    if (filtrePrix) {
      const prixRecherche = parseFloat(filtrePrix.replace(',', '.'))
      if (!isNaN(prixRecherche)) {
        result = result.filter(v => getPrix(v) === prixRecherche)
      }
    }

    // Statut (admin)
    if (isAdmin && filtreStatut !== 'all') {
      if (filtreStatut === 'attribue') {
        result = result.filter(v => v.isAttribue)
      } else {
        result = result.filter(v => !v.isAttribue)
      }
    }

    return result
  }, [ventes, recherche, filtreMois, filtreChineuse, filtrePrix, filtreStatut, isAdmin])

  // =====================
  // TRI
  // =====================
  const ventesTriees = useMemo(() => {
  return [...ventesFiltrees].sort((a, b) => {
    if (tri === 'alpha') {
      return (a.nom || '').localeCompare(b.nom || '')
    }
    if (tri === 'prix-asc') {
      return getPrix(a) - getPrix(b)
    }
    if (tri === 'prix-desc') {
      return getPrix(b) - getPrix(a)
    }
    // Date (dateVente)
    const dateA = getDateFromVente(a).getTime()
    const dateB = getDateFromVente(b).getTime()
    return tri === 'date-asc' ? dateA - dateB : dateB - dateA
  })
}, [ventesFiltrees, tri])

// Infinite scroll observer
useEffect(() => {
  const loader = loaderRef.current
  if (!loader) return
  
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && visibleCount < ventesTriees.length) {
        setVisibleCount(prev => Math.min(prev + 20, ventesTriees.length))
      }
    },
    { threshold: 0.1, rootMargin: '100px' }
  )
  
  observer.observe(loader)
  return () => observer.disconnect()
}, [visibleCount, ventesTriees.length])

// Reset quand les filtres changent
useEffect(() => {
  setVisibleCount(20)
}, [recherche, filtreMois, filtreChineuse, filtrePrix, filtreStatut, tri])

  // =====================
  // STATS
  // =====================
  const stats = useMemo(() => {
    const nb = ventesTriees.length
    const ca = ventesTriees.reduce((s, v) => s + getPrix(v), 0)
    const attribuees = ventesTriees.filter(v => v.isAttribue).length
    const nonAttribuees = ventesTriees.filter(v => !v.isAttribue).length
    return { nb, ca, attribuees, nonAttribuees }
  }, [ventesTriees])

  // =====================
  // SÉLECTION (ADMIN)
  // =====================
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }

  const selectAll = () => {
    if (selectedIds.size === ventesTriees.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(ventesTriees.map(v => v.id)))
    }
  }

  const handleDeleteBatch = () => {
    if (onSupprimerBatch && selectedIds.size > 0) {
      onSupprimerBatch(Array.from(selectedIds))
      setSelectedIds(new Set())
      setShowDeleteModal(false)
    }
  }

  // =====================
  // SYNC SIMPLIFIÉ
  // =====================
  const handleSyncRecent = async () => {
    if (!onSync) return
    
    // Depuis la dernière vente (ou il y a 7 jours si pas de vente)
    const startDate = derniereVenteDate 
      ? format(derniereVenteDate, 'yyyy-MM-dd')
      : format(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
    
    // Jusqu'à aujourd'hui
    const endDate = format(new Date(), 'yyyy-MM-dd')
    
    await onSync(startDate, endDate)
  }

  // =====================
  // IMPORT EXCEL
  // =====================
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      await importExcelFile(file)
    }
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await importExcelFile(file)
    e.target.value = ''
  }, [])

  const importExcelFile = async (file: File) => {
    if (!onImportExcel) return
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data)
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet)
    await onImportExcel(rows)
  }

  // =====================
  // EXPORT CSV
  // =====================
  const exportCSV = () => {
    const rows = [
      ['Nom', 'Description', 'Catégorie', 'Prix (€)', 'Date de vente'],
      ...ventesTriees.map(v => [
        v.nom || '',
        v.description || '',
        getCategorie(v),
        getPrix(v).toString().replace('.', ','),
        formatDateVente(v)
      ])
    ]
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ventes_${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  // =====================
  // EXPORT FACTURE PDF
  // =====================
  const getVendorCode = (ch: ChineuseMeta | null | undefined, ventesDuMois: Vente[]): string => {
    const direct = (ch?.codeChineuse || ch?.code || '').toString().trim()
    if (direct) return direct.toUpperCase()

    const label = ventesDuMois.find(v => v?.categorie)?.categorie
    const raw = typeof label === 'object' && label?.label ? label.label : typeof label === 'string' ? label : ''
    if (raw.includes(' - ')) return raw.split(' - ')[0].trim().toUpperCase()

    const nom = (ch?.nom || '').toString().trim()
    if (nom) return nom.split(/\s+/)[0].toUpperCase()
    return 'NR'
  }

  const generateInvoiceFor = (monthValue: string) => {
    if (!chineuse && !userEmail) return

    const dep = deposants.find((d: any) => 
      d.email === userEmail || 
      d.email === chineuse?.nom || 
      d.nom === chineuse?.nom ||
      d.trigramme === chineuse?.codeChineuse
    )

   const chineuseComplete = {
      ...chineuse,
      taux: chineuse?.taux ?? dep?.taux,
      siret: chineuse?.siret || dep?.siret,
      adresse1: chineuse?.adresse1 || dep?.adresse1,
      adresse2: chineuse?.adresse2 || dep?.adresse2,
      tva: chineuse?.tva || dep?.tva,
      iban: chineuse?.iban || dep?.iban,
      bic: chineuse?.bic || dep?.bic,
      banqueAdresse: chineuse?.banqueAdresse || dep?.banqueAdresse,
    }
      
    const [m, y] = monthValue.split('-').map(Number)
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0, 23, 59, 59, 999)

    const ventesDuMois = ventes.filter(v => {
      const d = getDateFromVente(v)
      return d >= start && d <= end
    })

    const ca = ventesDuMois.reduce((s, v) => s + getPrix(v), 0)
    const tauxHT = typeof chineuseComplete?.taux === 'number' 
      ? chineuseComplete.taux / 100 
      : (typeof chineuseComplete?.commissionHT === 'number' ? chineuseComplete.commissionHT : 0.40)
    const commissionHT = ca * tauxHT
    const commissionTTC = commissionHT * 1.2
    const tva = commissionTTC - commissionHT
    const net = ca - commissionTTC

    const code = getVendorCode(chineuse, ventesDuMois)
    const ref = `NR${String(m).padStart(2, '0')}${String(y).slice(-2)}-${code}`

    const fmt = (n: number) => n.toFixed(2).replace('.', ',')
    const fmtEUR = (n: number) => n.toFixed(2).replace('.', ',') + ' €'

    const docPDF = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageW = docPDF.internal.pageSize.getWidth()
    const margin = 32
    const contentW = pageW - margin * 2
    const leftW = contentW * (2 / 3)
    const rightX = margin + leftW + 16

    docPDF.setFontSize(10)

    docPDF.setFont('helvetica', 'bold')
    docPDF.text((chineuse?.nom || userEmail || '').toUpperCase(), margin, 52)
    docPDF.setFont('helvetica', 'normal')

    const siret = chineuseComplete?.siret || ''
    const ad1 = chineuseComplete?.adresse1 || ''
    const ad2 = chineuseComplete?.adresse2 || ''
    const tvaNum = chineuseComplete?.tva || ''

    let yLeft = 68
    ;[siret && `SIRET ${siret}`, ad1, ad2, tvaNum && `TVA ${tvaNum}`].filter(Boolean).forEach((line: string) => {
      docPDF.text(line, margin, yLeft)
      yLeft += 16
    })

    docPDF.text('NR1 SAS', rightX, 52)
    docPDF.setTextColor(34, 32, 156)
    docPDF.text('941 895 203 00011', rightX, 68)
    docPDF.setTextColor(0, 0, 0)

    const rightBlock = ['5 route du Grand Pont', '78110 Le Vésinet', 'FR5894189520']
    let yRight = 84
    rightBlock.forEach(t => {
      docPDF.text(t, rightX, yRight)
      yRight += 16
    })

    const headerBottom = Math.max(yLeft, yRight) + 24
    const yMetaTop = headerBottom
    const periodeTxt = format(start, 'LLLL yyyy', { locale: fr })

    docPDF.text('Ref facture', margin, yMetaTop)
    docPDF.text(ref, margin + 110, yMetaTop)
    docPDF.text('Période', margin, yMetaTop + 16)
    docPDF.text(periodeTxt, margin + 110, yMetaTop + 16)

    const yHead = yMetaTop + 46
    const hHead = 36
    docPDF.setFillColor(34, 32, 156)
    docPDF.rect(margin, yHead, contentW, hHead, 'F')

    type Col = { lines: string[]; width: number; align?: 'left' | 'right' }
    const cols: Col[] = [
      { lines: ['Descriptif'], width: contentW * 0.40, align: 'left' },
      { lines: ["Prix de l'article"], width: contentW * 0.14, align: 'right' },
      { lines: ['Commission', 'NR HT'], width: contentW * 0.14, align: 'right' },
      { lines: ['Commission', 'NR TTC'], width: contentW * 0.14, align: 'right' },
      { lines: ['TVA'], width: contentW * 0.08, align: 'right' },
      { lines: ['Net à nous', 'devoir'], width: contentW * 0.10, align: 'right' },
    ]

    docPDF.setTextColor(255, 255, 255)
    let x = margin + 8
    cols.forEach(col => {
      const lineY1 = yHead + 14
      const lineY2 = yHead + 28
      if (col.lines.length === 1) {
        docPDF.text(col.lines[0], x, yHead + 22)
      } else {
        docPDF.text(col.lines[0], x, lineY1)
        docPDF.text(col.lines[1], x, lineY2)
      }
      x += col.width
    })
    docPDF.setTextColor(0, 0, 0)

    const rowY = yHead + hHead + 22
    const values = ['Lot de pièces vintage', fmt(ca), fmt(commissionHT), fmt(commissionTTC), fmt(tva), fmt(net)]

    x = margin + 8
    values.forEach((val, i) => {
      const col = cols[i]
      if (col.align === 'right') {
        const tw = docPDF.getTextWidth(val)
        docPDF.text(val, x + col.width - 8 - tw, rowY)
      } else {
        docPDF.text(val, x, rowY)
      }
      x += col.width
    })

    const yPay = rowY + 42
    docPDF.text('À payer', margin, yPay)
    docPDF.text(fmtEUR(net), margin, yPay + 16)

    const yBank = yPay + 56
    docPDF.text('IBAN', margin, yBank)
    docPDF.text(chineuseComplete?.iban || 'xxx', margin + 120, yBank)
    docPDF.text('BIC', margin, yBank + 16)
    docPDF.text(chineuseComplete?.bic || 'xxx', margin + 120, yBank + 16)
    docPDF.text('Adresse Banque', margin, yBank + 32)
    docPDF.text(chineuseComplete?.banqueAdresse || 'xxx', margin + 120, yBank + 32)

    docPDF.save(`facture_${ref}.pdf`)
  }

  // =====================
  // RESET FILTRES
  // =====================
  const resetFilters = () => {
    setRecherche('')
    setFiltreMois('')
    setFiltreChineuse('')
    setFiltrePrix('')
    setFiltreStatut('all')
    setTri('date-desc')
  }

  const hasActiveFilters = !!(recherche || filtreMois || (isAdmin && filtreChineuse) || filtrePrix || filtreStatut !== 'all')

  // =====================
  // RENDER
  // =====================
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
      </div>
    )
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      
      {/* Header : Titre */}
      <div className="mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-[#22209C] text-center uppercase">{titre}</h1>
      </div>

      {/* Ligne : Sync/Actualiser + Stats */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Bouton Sync (admin) */}
        {isAdmin && onSync && (
          <button
            onClick={handleSyncRecent}
            disabled={syncLoading}
            className="flex items-center gap-2 bg-[#22209C] text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-[#1a1a7a] transition-colors"
          >
            <RefreshCw size={16} className={syncLoading ? 'animate-spin' : ''} />
            {syncLoading ? 'Sync...' : 'Synchroniser'}
          </button>
        )}

        {/* Bouton Actualiser (chineuse) */}
        {!isAdmin && onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 bg-[#22209C] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1a1a7a] transition-colors"
          >
            <RefreshCw size={16} />
            Actualiser
          </button>
        )}

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="bg-white border rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-xs text-gray-500">Total</span>
            <span className="font-bold">{stats.nb}</span>
          </div>
          
          {isAdmin && (
            <>
              <div className="bg-white border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-xs text-green-600">Attribuées</span>
                <span className="font-bold text-green-600">{stats.attribuees}</span>
              </div>
              <div className="bg-white border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-xs text-amber-600">À attribuer</span>
                <span className="font-bold text-amber-600">{stats.nonAttribuees}</span>
              </div>
            </>
          )}
          
          <div className="bg-white border border-blue-200 rounded-lg px-3 py-2 flex items-center gap-2">
            <span className="text-xs text-blue-600">CA</span>
            <span className="font-bold text-blue-600">{stats.ca.toFixed(2)}€</span>
          </div>
        </div>
      </div>

      {/* Info dernière sync (admin) */}
      {isAdmin && derniereVenteDate && (
        <p className="text-xs text-gray-500 -mt-4 mb-4">
          Dernière vente : {format(derniereVenteDate, 'dd/MM/yyyy', { locale: fr })}
        </p>
      )}

      {/* Section Filtres + Télécharger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        
        {/* FILTRER */}
        <FilterBox
          className="lg:col-span-2"
          hasActiveFilters={hasActiveFilters}
          onReset={resetFilters}
          filters={{
            recherche: {
              value: recherche,
              onChange: setRecherche,
              placeholder: 'SKU, nom, remarque...'
            },
            mois: {
              value: filtreMois,
              onChange: setFiltreMois,
              options: moisDisponibles.map(({ value, label }) => ({
                value,
                label: label.charAt(0).toUpperCase() + label.slice(1)
              }))
            },
            ...(isAdmin && {
              chineuse: {
                value: filtreChineuse,
                onChange: setFiltreChineuse,
                options: chineusesDisponibles.map(c => ({
                  value: c.trigramme,
                  label: `${c.trigramme} - ${c.nom}`
                }))
              }
            }),
            prix: {
              value: filtrePrix,
              onChange: setFiltrePrix,
            },
            tri: {
              value: tri,
              onChange: (v) => setTri(v as 'date-desc' | 'date-asc' | 'alpha' | 'prix-asc' | 'prix-desc'),
            },
            ...(isAdmin && {
              statut: {
                value: filtreStatut,
                onChange: (v) => setFiltreStatut(v as 'all' | 'attribue' | 'non-attribue'),
                options: [
                  { value: 'all', label: 'Tous statuts' },
                  { value: 'attribue', label: 'Attribuées' },
                  { value: 'non-attribue', label: 'Non attribuées' },
                ]
              }
            }),
          }}
        />

        {/* TÉLÉCHARGER */}
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Télécharger</h2>

          <div className="flex flex-col gap-3">
            <button
              onClick={exportCSV}
              className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-white text-sm"
              style={{ background: PRIMARY }}
            >
              <FileSpreadsheet size={16} />
              Ventes en CSV
            </button>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowMonthSelect(s => !s)}
                className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-white text-sm"
                style={{ background: PRIMARY }}
              >
                <Download size={16} />
                Facture en PDF
              </button>

              {showMonthSelect && (
                <select
                  onChange={(e) => {
                    if (e.target.value) generateInvoiceFor(e.target.value)
                  }}
                  defaultValue=""
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                >
                  <option value="" disabled>Choisir un mois…</option>
                  {moisDisponibles.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label.charAt(0).toUpperCase() + label.slice(1)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <p className="text-xs text-gray-500">
              La facture est à retourner par mail à nouvelleriveparis@gmail.com
            </p>
          </div>
        </div>
      </div>

      {/* Import Excel (admin) */}
      {isAdmin && onImportExcel && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mb-6 border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            id="excel-upload"
          />
          <label htmlFor="excel-upload" className="cursor-pointer">
            <div className="flex items-center justify-center gap-3">
              <Upload size={20} className="text-gray-400" />
              <span className="text-sm text-gray-600">
                {importLoading ? 'Import en cours...' : 'Glisser un fichier Excel Square ou cliquer'}
              </span>
            </div>
          </label>
        </div>
      )}

      {/* Sélection groupée (admin) */}
      {isAdmin && selectedIds.size > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="font-medium">{selectedIds.size} vente{selectedIds.size > 1 ? 's' : ''} sélectionnée{selectedIds.size > 1 ? 's' : ''}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1 border rounded-lg text-sm hover:bg-white"
            >
              Désélectionner
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 flex items-center gap-1"
            >
              <Trash2 size={14} />
              Supprimer
            </button>
          </div>
        </div>
      )}

      {/* Header sélection (admin) */}
      {isAdmin && (
        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg mb-2">
          <button onClick={selectAll} className="text-gray-500 hover:text-gray-700">
            {selectedIds.size === ventesTriees.length && ventesTriees.length > 0 ? (
              <CheckSquare size={20} />
            ) : (
              <Square size={20} />
            )}
          </button>
          <span className="text-sm text-gray-500">
            {selectedIds.size === 0 ? 'Tout sélectionner' : `${selectedIds.size} sélectionnée(s)`}
          </span>
        </div>
      )}

      {/* Liste des ventes */}
      <div className="space-y-3">
        {ventesTriees.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <p className="text-gray-400">Aucune vente</p>
          </div>
        ) : (
          ventesTriees.slice(0, visibleCount).map(vente => {
            const cat = getCategorie(vente)
            const prix = getPrix(vente)
            const isSelected = selectedIds.has(vente.id)

            return (
              <div
                key={vente.id}
                className={`bg-white rounded-xl border p-4 shadow-sm ${
                  isAdmin && vente.isAttribue ? 'border-l-4 border-l-green-500' : ''
                } ${isAdmin && !vente.isAttribue ? 'border-l-4 border-l-amber-500' : ''} ${
                  isSelected ? 'ring-2 ring-blue-300 bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox (admin) */}
                  {isAdmin && (
                    <button
                      onClick={() => toggleSelect(vente.id)}
                      className="flex-shrink-0 text-gray-400 hover:text-gray-600 mt-1"
                    >
                      {isSelected ? (
                        <CheckSquare size={20} className="text-blue-500" />
                      ) : (
                        <Square size={20} />
                      )}
                    </button>
                  )}

                  {/* Icône statut (admin) */}
                  {isAdmin && (
                    <div className={`flex-shrink-0 mt-1 ${vente.isAttribue ? 'text-green-500' : 'text-amber-500'}`}>
                      {vente.isAttribue ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                    </div>
                  )}

                  {/* Infos principales */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {vente.trigramme && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                          {vente.trigramme}
                        </span>
                      )}
                      <p className="font-semibold text-gray-900">
                        {vente.sku && <span className="text-[#22209C]">{vente.sku} - </span>}
                        {(vente.nom || vente.remarque || 'Vente sans nom').replace(new RegExp(`^${vente.sku}\\s*-\\s*`, 'i'), '')}
                      </p>
                    </div>
                    {vente.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{vente.description}</p>
                    )}
                    <p className="text-sm text-gray-400 mt-1">
                      Vendu le {formatDateVente(vente)}
                      {cat && <span className="ml-2">• {cat}</span>}
                    </p>
                    {isAdmin && !vente.isAttribue && vente.remarque && (
                      <p className="text-sm text-amber-600 mt-1">Note: {vente.remarque}</p>
                    )}
                  </div>

                  {/* Prix */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-green-600 text-lg">{prix}€</p>
                    {vente.prixInitial && vente.prixInitial !== prix && (
                      <p className="text-xs text-gray-400">Initial: {vente.prixInitial}€</p>
                    )}
                  </div>

                  {/* Actions (admin) */}
                  {isAdmin && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {onAttribuer && (
                        <button
                          onClick={() => onAttribuer(vente)}
                          className={`p-2 rounded-lg ${
                            vente.isAttribue
                              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                          }`}
                          title={vente.isAttribue ? 'Réattribuer' : 'Attribuer'}
                        >
                          <Link size={16} />
                        </button>
                      )}
                      {onModifierPrix && (
                        <button
                          onClick={() => onModifierPrix(vente)}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                          title="Modifier"
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                      {onSupprimer && (
                        <button
                          onClick={() => onSupprimer(vente)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Loader infinite scroll */}
      {visibleCount < ventesTriees.length && (
        <div ref={loaderRef} className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#22209C]" />
        </div>
      )}

      {/* Modal suppression groupée */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              Supprimer {selectedIds.size} vente{selectedIds.size > 1 ? 's' : ''} ?
            </h3>
            <p className="text-gray-600 mb-4">Cette action est irréversible.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteBatch}
                className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}