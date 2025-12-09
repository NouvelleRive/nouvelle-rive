  // components/SalesList.tsx
  'use client'

  import { useState, useMemo, useCallback, useEffect } from 'react'
  import { Timestamp } from 'firebase/firestore'
  import { format } from 'date-fns'
  import { fr } from 'date-fns/locale'
  import jsPDF from 'jspdf'
  import * as XLSX from 'xlsx'
  import { 
    Search, X, Download, FileSpreadsheet, RefreshCw, 
    Plus, Trash2, Link, CheckCircle, AlertCircle, 
    CheckSquare, Square, Upload, ChevronDown, ChevronUp
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
    userEmail?: string
    isAdmin?: boolean
    loading?: boolean
    // Callbacks admin
    onAttribuer?: (vente: Vente) => void
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
    userEmail,
    isAdmin = false,
    loading = false,
    onAttribuer,
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
    const [filtreCategorie, setFiltreCategorie] = useState('')
    const [filtreStatut, setFiltreStatut] = useState<'all' | 'attribue' | 'non-attribue'>('all')
    const [tri, setTri] = useState<'date' | 'nom' | 'prix'>('date')

    // Sync dates
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    // Sélection (admin)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [showDeleteModal, setShowDeleteModal] = useState(false)

    // Export
    const [showMonthSelect, setShowMonthSelect] = useState(false)

    // Import Excel drag & drop
    const [isDragging, setIsDragging] = useState(false)

    // Mobile: section collapsible
    const [showFilters, setShowFilters] = useState(false)

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
    // CATÉGORIES DISPONIBLES
    // =====================
    const categoriesDisponibles = useMemo(() => {
      const set = new Set<string>()
      ventes.forEach(v => {
        const cat = getCategorie(v)
        if (cat) set.add(cat)
      })
      return Array.from(set).sort()
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

      // Catégorie
      if (filtreCategorie) {
        result = result.filter(v => getCategorie(v) === filtreCategorie)
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
    }, [ventes, recherche, filtreMois, filtreCategorie, filtreStatut, isAdmin])

    // =====================
    // TRI
    // =====================
    const ventesTriees = useMemo(() => {
      const arr = [...ventesFiltrees]
      if (tri === 'nom') {
        arr.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''))
      } else if (tri === 'prix') {
        arr.sort((a, b) => getPrix(b) - getPrix(a))
      } else {
        arr.sort((a, b) => getDateFromVente(b).getTime() - getDateFromVente(a).getTime())
      }
      return arr
    }, [ventesFiltrees, tri])

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
    // SYNC
    // =====================
    const handleSync = async () => {
      if (onSync && startDate && endDate) {
        await onSync(startDate, endDate)
      }
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
    console.log('🔥 generateInvoiceFor appelé avec:', monthValue)
    if (!chineuse && !userEmail) return

    // Chercher les infos complètes dans deposants

    const dep = deposants.find((d: any) => 
    d.email === userEmail || 
    d.email === chineuse?.nom || 
    d.nom === chineuse?.nom ||
    d.trigramme === chineuse?.codeChineuse
  )
    const catRapport = dep ? (dep['Catégorie de rapport'] || [])[0] || {} : {}
    
    // Fusionner avec les infos passées en props
    const chineuseComplete = {
      ...chineuse,
      taux: chineuse?.taux ?? catRapport.taux,
      siret: chineuse?.siret || catRapport.siret,
      adresse1: chineuse?.adresse1 || catRapport.adresse1,
      adresse2: chineuse?.adresse2 || catRapport.adresse2,
      tva: chineuse?.tva || catRapport.tva,
      iban: chineuse?.iban || catRapport.iban,
      bic: chineuse?.bic || catRapport.bic,
      banqueAdresse: chineuse?.banqueAdresse || catRapport.banqueAdresse,
    }
    
    console.log('🔍 chineuseComplete:', chineuseComplete)
      const [m, y] = monthValue.split('-').map(Number)
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m, 0, 23, 59, 59, 999)

      const ventesDuMois = ventes.filter(v => {
        const d = getDateFromVente(v)
        return d >= start && d <= end
      })

      const ca = ventesDuMois.reduce((s, v) => s + getPrix(v), 0)
      console.log('🔍 DEBUG taux:', chineuseComplete?.taux, typeof chineuseComplete?.taux)
      const tauxHT = typeof chineuseComplete?.taux === 'number' 
        ? chineuseComplete.taux / 100 
        : (typeof chineuseComplete?.commissionHT === 'number' ? chineuseComplete.commissionHT : 0.40)
      const commissionHT = ca * tauxHT
      const commissionTTC = commissionHT * 1.2
      const tva = commissionTTC - commissionHT
      const net = ca - commissionTTC

      const code = getVendorCode(chineuse, ventesDuMois)
      const ref = `NR${String(m).padStart(2, '0')}${String(y).slice(-2)}-${code}`

      const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n).replace(/\u00A0/g, ' ')
      const fmtEUR = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n).replace(/\u00A0/g, ' ')

      const docPDF = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageW = docPDF.internal.pageSize.getWidth()
      const margin = 32
      const contentW = pageW - margin * 2
      const leftW = contentW * (2 / 3)
      const rightX = margin + leftW + 16

      docPDF.setFontSize(10)

      // En-tête gauche : Chineuse
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

      // En-tête droite : NR1
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
      setFiltreCategorie('')
      setFiltreStatut('all')
      setTri('date')
    }

    const hasActiveFilters = recherche || filtreMois || filtreCategorie || filtreStatut !== 'all'

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
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-[#22209C] text-center">{titre}</h1>
        </div>

        {/* Section Filtres + Télécharger - RESPONSIVE */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* FILTRER */}
          <div className="lg:col-span-2 bg-white border rounded-xl p-4 shadow-sm">
            <button
              className="lg:hidden flex items-center justify-between w-full mb-2"
              onClick={() => setShowFilters(!showFilters)}
            >
              <h2 className="text-lg font-semibold">Filtrer</h2>
              {showFilters ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
            <h2 className="hidden lg:block text-lg font-semibold mb-4">Filtrer</h2>

            <div className={`${showFilters ? 'block' : 'hidden'} lg:block space-y-4`}>
              {/* Filtres principaux */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Mois</label>
                  <select
                    value={filtreMois}
                    onChange={(e) => setFiltreMois(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Tous</option>
                    {moisDisponibles.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label.charAt(0).toUpperCase() + label.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Catégorie</label>
                  <select
                    value={filtreCategorie}
                    onChange={(e) => setFiltreCategorie(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Toutes</option>
                    {categoriesDisponibles.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Trier par</label>
                  <select
                    value={tri}
                    onChange={(e) => setTri(e.target.value as any)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="date">Date</option>
                    <option value="nom">Nom</option>
                    <option value="prix">Prix</option>
                  </select>
                </div>
              </div>

              {/* Filtre statut (admin) */}
              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium mb-1">Statut</label>
                  <select
                    value={filtreStatut}
                    onChange={(e) => setFiltreStatut(e.target.value as any)}
                    className="w-full sm:w-auto border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="all">Tous statuts</option>
                    <option value="attribue">Attribuées</option>
                    <option value="non-attribue">Non attribuées</option>
                  </select>
                </div>
              )}

              {/* Sync Square */}
              {onSync && (
                <div className="pt-4 border-t">
                  <h3 className="text-sm font-medium mb-2">Synchroniser avec la caisse</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Début</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Fin</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                    <button
                      onClick={handleSync}
                      disabled={syncLoading || !startDate || !endDate}
                      className="flex items-center justify-center gap-2 bg-[#22209C] text-white px-4 py-2 rounded-lg text-sm disabled:opacity-50"
                    >
                      <RefreshCw size={16} className={syncLoading ? 'animate-spin' : ''} />
                      {syncLoading ? 'Sync...' : 'Recevoir de la caisse'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

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

        {/* Stats (admin) */}
        {isAdmin && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white border rounded-xl p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-gray-500">Total</p>
              <p className="text-xl sm:text-2xl font-bold">{stats.nb}</p>
            </div>
            <div className="bg-white border border-green-200 rounded-xl p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-green-600">Attribuées</p>
              <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.attribuees}</p>
            </div>
            <div className="bg-white border border-amber-200 rounded-xl p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-amber-600">À attribuer</p>
              <p className="text-xl sm:text-2xl font-bold text-amber-600">{stats.nonAttribuees}</p>
            </div>
            <div className="bg-white border border-blue-200 rounded-xl p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-blue-600">CA</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats.ca.toFixed(2)}€</p>
            </div>
          </div>
        )}

        {/* Résumé (chineuse) */}
        {!isAdmin && (
          <div className="bg-white border rounded-xl p-4 mb-6">
            <h2 className="text-lg font-semibold">Ventes</h2>
            <p className="text-sm text-gray-600 mt-1">
              Total CA :{' '}
              <span className="font-semibold">
                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(stats.ca)}
              </span>{' '}
              — {stats.nb} pièce{stats.nb > 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Barre recherche + actions */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher SKU, nom..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
            />
          </div>

          {hasActiveFilters && (
            <button onClick={resetFilters} className="text-sm text-[#22209C] flex items-center gap-1">
              <X size={14} /> Reset filtres
            </button>
          )}

          {isAdmin && onAjouterVente && (
            <button
              onClick={onAjouterVente}
              className="flex items-center justify-center gap-2 px-4 py-2 border-2 border-[#22209C] text-[#22209C] rounded-lg text-sm hover:bg-[#22209C] hover:text-white transition-colors"
            >
              <Plus size={16} />
              Ajouter une vente
            </button>
          )}
        </div>

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
            ventesTriees.map(vente => {
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