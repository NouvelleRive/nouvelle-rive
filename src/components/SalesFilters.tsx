'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Timestamp } from 'firebase/firestore'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import jsPDF from 'jspdf'
import FilterBox from '@/components/FilterBox'
import { Download, FileSpreadsheet, LayoutGrid, List } from 'lucide-react'
import { Vente, ChineuseMeta } from '@/components/SalesList'


const PRIMARY = '#22209C'

interface SalesFiltersProps {
  ventes: Vente[]
  chineuse?: ChineuseMeta | null
  deposants?: any[]
  chineuses?: Array<{ trigramme: string; nom: string }>
  userEmail?: string
  isAdmin?: boolean
  isDeposante?: boolean
  viewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  onFiltered: (ventes: Vente[]) => void
}

export default function SalesFilters({
  ventes,
  chineuse,
  deposants = [],
  chineuses = [],
  userEmail,
  isAdmin = false,
  isDeposante = false,
  viewMode,
  onViewModeChange,
  onFiltered,
}: SalesFiltersProps) {
  const [recherche, setRecherche] = useState('')
  const [filtreMois, setFiltreMois] = useState('')
  const [filtreChineuse, setFiltreChineuse] = useState('')
  const [filtrePrix, setFiltrePrix] = useState('')
  const [filtreStatut, setFiltreStatut] = useState<'all' | 'attribue' | 'non-attribue'>('all')
  const [tri, setTri] = useState<'date-desc' | 'date-asc' | 'alpha' | 'prix-asc' | 'prix-desc'>('date-desc')
  const [showMonthSelect, setShowMonthSelect] = useState(false)
  const [showAttestationModal, setShowAttestationModal] = useState(false)
  const [pendingMonth, setPendingMonth] = useState('')
  const [cni, setCni] = useState('')
  const [isDrawing, setIsDrawing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const getDateFromVente = (v: Vente): Date => {
    if (v.dateVente && typeof (v.dateVente as any).toDate === 'function') return (v.dateVente as any).toDate()
    if (typeof v.dateVente === 'string') return new Date(v.dateVente)
    return new Date()
  }

  const getPrix = (v: Vente): number =>
    typeof v.prixVenteReel === 'number' ? v.prixVenteReel : (v.prix || 0)

  const getCategorie = (v: Vente): string =>
    typeof v.categorie === 'object' ? v.categorie?.label : (v.categorie || '')

  const getTrigrammeFromVente = (v: Vente): string => {
    if (v.trigramme) return v.trigramme.toUpperCase()
    if (v.sku) { const m = v.sku.match(/^([A-Za-z]+)/i); if (m) return m[1].toUpperCase() }
    const cat = getCategorie(v)
    if (cat?.includes(' - ')) return cat.split(' - ')[0].trim().toUpperCase()
    return ''
  }

  const formatDateVente = (v: Vente): string => {
    const d = getDateFromVente(v)
    return isNaN(d.getTime()) ? '—' : format(d, 'dd/MM/yyyy')
  }

  const moisDisponibles = useMemo(() => {
    const set = new Set<string>()
    ventes.forEach(v => {
      const d = getDateFromVente(v)
      if (!isNaN(d.getTime())) set.add(`${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`)
    })
    return Array.from(set).map(val => {
      const [m, y] = val.split('-').map(Number)
      return { value: val, label: format(new Date(y, m - 1), 'MMMM yyyy', { locale: fr }) }
    }).sort((a, b) => {
      const [mA, yA] = a.value.split('-').map(Number)
      const [mB, yB] = b.value.split('-').map(Number)
      return new Date(yB, mB - 1).getTime() - new Date(yA, mA - 1).getTime()
    })
  }, [ventes])

  const chineusesDisponibles = useMemo(() => {
    const map = new Map<string, string>()
    chineuses.forEach(c => { if (c.trigramme) map.set(c.trigramme.toUpperCase(), c.nom || c.trigramme) })
    ventes.forEach(v => { const t = getTrigrammeFromVente(v); if (t && !map.has(t)) map.set(t, t) })
    return Array.from(map.entries()).map(([trigramme, nom]) => ({ trigramme, nom })).sort((a, b) => a.trigramme.localeCompare(b.trigramme))
  }, [ventes, chineuses])

  const ventesFiltrées = useMemo(() => {
    let result = [...ventes]
    if (recherche.trim()) {
      const term = recherche.toLowerCase()
      result = result.filter(v =>
        v.nom?.toLowerCase().includes(term) || v.sku?.toLowerCase().includes(term) ||
        v.remarque?.toLowerCase().includes(term) || v.trigramme?.toLowerCase().includes(term) ||
        v.description?.toLowerCase().includes(term)
      )
    }
    if (filtreMois) {
      result = result.filter(v => {
        const d = getDateFromVente(v)
        const key = isNaN(d.getTime()) ? '' : `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
        return key === filtreMois
      })
    }
    if (filtreChineuse) result = result.filter(v => getTrigrammeFromVente(v) === filtreChineuse.toUpperCase())
    if (filtrePrix) {
      const p = parseFloat(filtrePrix.replace(',', '.'))
      if (!isNaN(p)) result = result.filter(v => getPrix(v) === p)
    }
    if (isAdmin && filtreStatut !== 'all') {
      result = result.filter(v => filtreStatut === 'attribue' ? v.isAttribue : !v.isAttribue)
    }
    return [...result].sort((a, b) => {
      if (tri === 'alpha') return (a.nom || '').localeCompare(b.nom || '')
      if (tri === 'prix-asc') return getPrix(a) - getPrix(b)
      if (tri === 'prix-desc') return getPrix(b) - getPrix(a)
      const dA = getDateFromVente(a).getTime(), dB = getDateFromVente(b).getTime()
      return tri === 'date-asc' ? dA - dB : dB - dA
    })
  }, [ventes, recherche, filtreMois, filtreChineuse, filtrePrix, filtreStatut, tri, isAdmin])

  useEffect(() => { onFiltered(ventesFiltrées) }, [ventesFiltrées])

  const resetFilters = () => {
    setRecherche(''); setFiltreMois(''); setFiltreChineuse('')
    setFiltrePrix(''); setFiltreStatut('all'); setTri('date-desc')
  }
  const hasActiveFilters = !!(recherche || filtreMois || (isAdmin && filtreChineuse) || filtrePrix || filtreStatut !== 'all')

  // =====================
  // EXPORT CSV
  // =====================
  const exportCSV = () => {
    const rows = [
      ['Nom', 'Description', 'Catégorie', 'Prix (€)', 'Date de vente'],
      ...ventesFiltrées.map(v => [v.nom || '', v.description || '', getCategorie(v), getPrix(v).toString().replace('.', ','), formatDateVente(v)])
    ]
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `ventes_${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click()
  }

  // =====================
  // EXPORT FACTURE PDF
  // =====================

  const generateAttestationFor = (monthValue: string, cniNum = '', signatureDataUrl: string | null = null) => {
    const [m, annee] = monthValue.split('-').map(Number)
    const start = new Date(annee, m - 1, 1)
    const end = new Date(annee, m, 0, 23, 59, 59, 999)
    const ventesDuMois = ventes.filter(v => {
      const d = getDateFromVente(v)
      return d >= start && d <= end
    })
    const ca = ventesDuMois.reduce((s, v) => s + getPrix(v), 0)
    const nom = (chineuse?.nom || userEmail || '').toUpperCase()
    const periodeTxt = format(start, 'LLLL yyyy', { locale: fr })

    const docPDF = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageW = docPDF.internal.pageSize.getWidth()
    const margin = 60
    const contentW = pageW - margin * 2

    docPDF.setFontSize(10)
    docPDF.setFont('helvetica', 'normal')

    // En-tête NR
    docPDF.setFont('helvetica', 'bold')
    docPDF.text('NOUVELLE RIVE — NR1 SAS', margin, 60)
    docPDF.setFont('helvetica', 'normal')
    docPDF.text('5 route du Grand Pont, 78110 Le Vésinet', margin, 76)

    // Titre
    docPDF.setFontSize(14)
    docPDF.setFont('helvetica', 'bold')
    docPDF.text('ATTESTATION DE VENTE', pageW / 2, 140, { align: 'center' })
    docPDF.setFontSize(10)
    docPDF.setFont('helvetica', 'normal')
    docPDF.text(`Période : ${periodeTxt.charAt(0).toUpperCase() + periodeTxt.slice(1)}`, pageW / 2, 158, { align: 'center' })

    // Corps
    const lignes = [
      `Je soussigné(e) ${nom},`,
      `certifie avoir confié à la société NR1 SAS (Nouvelle Rive) un lot de pièces`,
      `vestimentaires de seconde main, et avoir perçu un montant total de`,
      `${ca.toFixed(2).replace('.', ',')} € au titre des ventes réalisées`,
      `au cours du mois de ${periodeTxt}.`,
      '',
      `Je certifie sur l'honneur l'exactitude de ces informations.`,
    ]

    let y = 220
    lignes.forEach(ligne => {
      docPDF.text(ligne, margin, y)
      y += 18
    })

    if (cniNum) {
      y += 8
      docPDF.text(`CNI / Passeport n° : ${cniNum}`, margin, y)
    }

    // Lieu + date
    y += 28
    docPDF.text(`Fait à ________________, le ${format(new Date(), 'dd/MM/yyyy')}`, margin, y)

    // Signature
    y += 50
    docPDF.text('Signature :', margin, y)
    if (signatureDataUrl) {
      docPDF.addImage(signatureDataUrl, 'PNG', margin, y + 8, 200, 60)
    } else {
      docPDF.rect(margin, y + 8, 200, 60)
    }

    docPDF.save(`attestation_${String(m).padStart(2, '0')}${String(annee).slice(-2)}_${nom}.pdf`)
  }

  const generateInvoiceFor = async (monthValue: string) => {
    if (!chineuse && !userEmail) return
    const dep = deposants.find((d: any) => d.email === userEmail || d.nom === chineuse?.nom || d.trigramme === chineuse?.codeChineuse)
    const ch = { ...chineuse, taux: chineuse?.taux ?? dep?.taux, siret: chineuse?.siret || dep?.siret, adresse1: chineuse?.adresse1 || dep?.adresse1, adresse2: chineuse?.adresse2 || dep?.adresse2, tva: chineuse?.tva || dep?.tva, iban: chineuse?.iban || dep?.iban, bic: chineuse?.bic || dep?.bic, banqueAdresse: chineuse?.banqueAdresse || dep?.banqueAdresse }
    const [m, y] = monthValue.split('-').map(Number)
    const start = new Date(y, m - 1, 1), end = new Date(y, m, 0, 23, 59, 59, 999)
    const ventesDuMois = ventes.filter(v => { const d = getDateFromVente(v); return d >= start && d <= end })
    const ca = ventesDuMois.reduce((s, v) => s + getPrix(v), 0)
    const tauxHT = typeof ch?.taux === 'number' ? ch.taux / 100 : (typeof ch?.commissionHT === 'number' ? ch.commissionHT : 0.40)
    const commissionHT = ca * tauxHT, commissionTTC = commissionHT * 1.2, tva = commissionTTC - commissionHT, net = ca - commissionTTC
    const code = (ch?.codeChineuse || ch?.code || ch?.nom?.split(/\s+/)[0] || 'NR').toString().trim().toUpperCase()
    const ref = `NR${String(m).padStart(2, '0')}${String(y).slice(-2)}-${code}`
    const fmt = (n: number) => n.toFixed(2).replace('.', ',')
    const fmtEUR = (n: number) => n.toFixed(2).replace('.', ',') + ' €'
    const docPDF = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageW = docPDF.internal.pageSize.getWidth()
    const margin = 32, contentW = pageW - margin * 2, rightX = margin + contentW * (2 / 3) + 16
    docPDF.setFontSize(10)
    docPDF.setFont('helvetica', 'bold')
    docPDF.text((ch?.nom || userEmail || '').toUpperCase(), margin, 52)
    docPDF.setFont('helvetica', 'normal')
    let yLeft = 68
    ;[ch?.siret && `SIRET ${ch.siret}`, ch?.adresse1, ch?.adresse2, ch?.tva && `TVA ${ch.tva}`].filter(Boolean).forEach((line: string) => { docPDF.text(line, margin, yLeft); yLeft += 16 })
    docPDF.text('NR1 SAS', rightX, 52)
    docPDF.setTextColor(34, 32, 156); docPDF.text('941 895 203 00011', rightX, 68); docPDF.setTextColor(0, 0, 0)
    let yRight = 84
    ;['5 route du Grand Pont', '78110 Le Vésinet', 'FR5894189520'].forEach(t => { docPDF.text(t, rightX, yRight); yRight += 16 })
    const yMetaTop = Math.max(yLeft, yRight) + 24
    const periodeTxt = format(start, 'LLLL yyyy', { locale: fr })
    docPDF.text('Numéro de facture', margin, yMetaTop); docPDF.text(ref, margin + 110, yMetaTop)
    docPDF.text('Période', margin, yMetaTop + 16); docPDF.text(periodeTxt, margin + 110, yMetaTop + 16)
    const dateEmission = new Date()
    const dateEcheance = new Date(dateEmission); dateEcheance.setDate(dateEcheance.getDate() + 30)
    docPDF.text('Date', margin, yMetaTop + 32); docPDF.text(format(dateEmission, 'dd/MM/yyyy', { locale: fr }), margin + 110, yMetaTop + 32)
    docPDF.text('Échéance', margin, yMetaTop + 48); docPDF.text(format(dateEcheance, 'dd/MM/yyyy', { locale: fr }), margin + 110, yMetaTop + 48)
    const yHead = yMetaTop + 78, hHead = 36
    docPDF.setFillColor(34, 32, 156); docPDF.rect(margin, yHead, contentW, hHead, 'F')
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
      if (col.lines.length === 1) docPDF.text(col.lines[0], x, yHead + 22)
      else { docPDF.text(col.lines[0], x, yHead + 14); docPDF.text(col.lines[1], x, yHead + 28) }
      x += col.width
    })
    docPDF.setTextColor(0, 0, 0)
    const rowY = yHead + hHead + 22
    x = margin + 8
    ;['Lot de pièces vintage', fmt(ca), fmt(commissionHT), fmt(commissionTTC), fmt(tva), fmt(net)].forEach((val, i) => {
      const col = cols[i]
      if (col.align === 'right') { const tw = docPDF.getTextWidth(val); docPDF.text(val, x + col.width - 8 - tw, rowY) }
      else docPDF.text(val, x, rowY)
      x += col.width
    })
    const yPay = rowY + 42
    docPDF.text('Montant HT', margin, yPay); docPDF.text(fmtEUR(commissionHT), margin + 160, yPay)
    docPDF.text('TVA 20%', margin, yPay + 18); docPDF.text(fmtEUR(tva), margin + 160, yPay + 18)
    docPDF.setFont('helvetica', 'bold')
    docPDF.text('Total TTC', margin, yPay + 36); docPDF.text(fmtEUR(commissionTTC), margin + 160, yPay + 36)
    docPDF.setFont('helvetica', 'normal')
    docPDF.text('Net à reverser', margin, yPay + 60); docPDF.text(fmtEUR(net), margin + 160, yPay + 60)
    const yBank = yPay + 56
    docPDF.text('IBAN', margin, yBank); docPDF.text(ch?.iban || 'xxx', margin + 120, yBank)
    docPDF.text('BIC', margin, yBank + 16); docPDF.text(ch?.bic || 'xxx', margin + 120, yBank + 16)
    docPDF.text('Adresse Banque', margin, yBank + 32); docPDF.text(ch?.banqueAdresse || 'xxx', margin + 120, yBank + 32)
    const pdfBase64 = docPDF.output('datauristring').split(',')[1]
    try {
      const res = await fetch('/api/embed-facturx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfBase64,
          invoiceData: {
            ref,
            dateEmission: format(new Date(), 'yyyy-MM-dd'),
            nom: ch?.nom || userEmail || '',
            siret: ch?.siret,
            tva: ch?.tva,
            iban: ch?.iban,
            ca,
            commissionHT,
            commissionTTC,
            tvaMontant: tva,
            net,
            periode: periodeTxt,
          }
        })
      })
      const { pdfBase64: resultBase64 } = await res.json()
      const link = document.createElement('a')
      link.href = `data:application/pdf;base64,${resultBase64}`
      link.download = `facture_${ref}.pdf`
      link.click()
    } catch (err) {
      console.error('Erreur Factur-X, fallback PDF simple:', err)
      docPDF.save(`facture_${ref}.pdf`)
    }
  }

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.beginPath(); ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top)
    setIsDrawing(true)
  }
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top); ctx.stroke()
  }
  const stopDraw = () => setIsDrawing(false)
  const clearCanvas = () => {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }
  const handleGenerateAttestation = () => {
    const canvas = canvasRef.current
    const signatureDataUrl = canvas ? canvas.toDataURL('image/png') : null
    generateAttestationFor(pendingMonth, cni, signatureDataUrl)
    setShowAttestationModal(false); setCni(''); clearCanvas()
  }

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* FILTRER + TOGGLE */}
      <div className="lg:col-span-2">
        <FilterBox
          hasActiveFilters={hasActiveFilters}
          onReset={resetFilters}
          filters={{
            recherche: { value: recherche, onChange: setRecherche, placeholder: 'SKU, nom, remarque...' },
            mois: { value: filtreMois, onChange: setFiltreMois, options: moisDisponibles.map(({ value, label }) => ({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })) },
            ...(isAdmin && { chineuse: { value: filtreChineuse, onChange: setFiltreChineuse, options: chineusesDisponibles.map(c => ({ value: c.trigramme, label: `${c.trigramme} - ${c.nom}` })) } }),
            prix: { value: filtrePrix, onChange: setFiltrePrix },
            tri: { value: tri, onChange: (v) => setTri(v as any) },
            ...(isAdmin && { statut: { value: filtreStatut, onChange: (v) => setFiltreStatut(v as any), options: [{ value: 'all', label: 'Tous statuts' }, { value: 'attribue', label: 'Attribuées' }, { value: 'non-attribue', label: 'Non attribuées' }] } }),
          }}
        />
        {/* Toggle vue */}
        <div className="flex gap-1 mt-3">
          <button
            onClick={() => onViewModeChange('grid')}
            className={`p-2 rounded-lg border transition ${viewMode === 'grid' ? 'bg-[#22209C] text-white border-[#22209C]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
            title="Vue grille"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-2 rounded-lg border transition ${viewMode === 'list' ? 'bg-[#22209C] text-white border-[#22209C]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
            title="Vue liste"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* TÉLÉCHARGER */}
      <div className="bg-white border rounded-xl p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Télécharger</h2>
        <div className="flex flex-col gap-3">
          <button onClick={exportCSV} className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-white text-sm" style={{ background: PRIMARY }}>
            <FileSpreadsheet size={16} /> Ventes en CSV
          </button>
          <button onClick={() => setShowMonthSelect(s => !s)} className="flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-white text-sm" style={{ background: PRIMARY }}>
            <Download size={16} /> {isDeposante ? 'Attestation de vente' : 'Facture en PDF'}
          </button>
          {showMonthSelect && (
            <select onChange={(e) => { if (e.target.value) { if (isDeposante) { setPendingMonth(e.target.value); setShowAttestationModal(true) } else { generateInvoiceFor(e.target.value) } } }} defaultValue="" className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="" disabled>Choisir un mois…</option>
              {moisDisponibles.map(({ value, label }) => <option key={value} value={value}>{label.charAt(0).toUpperCase() + label.slice(1)}</option>)}
            </select>
          )}
          <p className="text-xs text-gray-500">{isDeposante ? "L'attestation est à retourner signée par mail à nouvelleriveparis@gmail.com" : 'La facture est à retourner par mail à nouvelleriveparis@gmail.com'}</p>
        </div>
      </div>
    </div>

    {showAttestationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-base font-bold uppercase mb-4" style={{ letterSpacing: '0.1em' }}>Attestation de vente</h3>
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase mb-1" style={{ letterSpacing: '0.1em' }}>N° CNI ou Passeport</label>
              <input value={cni} onChange={e => setCni(e.target.value)} placeholder="Ex: 123456789" className="w-full border px-3 py-2 text-sm rounded-lg" />
            </div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase" style={{ letterSpacing: '0.1em' }}>Signature</label>
                <button onClick={clearCanvas} className="text-xs text-gray-400 underline">Effacer</button>
              </div>
              <canvas ref={canvasRef} width={380} height={120} className="w-full border rounded-lg cursor-crosshair bg-gray-50" onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAttestationModal(false)} className="px-4 py-2 border rounded-lg text-sm">Annuler</button>
              <button onClick={handleGenerateAttestation} className="px-4 py-2 text-white text-sm rounded-lg" style={{ background: PRIMARY }}>Générer le PDF</button>
            </div>
          </div>
        </div>
      )}
  </>
  )
}