'use client'

import { useState, useEffect, useMemo } from 'react'
import { auth, db } from '@/lib/firebaseConfig'
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  Timestamp,
} from 'firebase/firestore'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CheckCircle, Download, ExternalLink, Mail } from 'lucide-react'
import { formatPrix } from '@/lib/formatPrix'

type Chineuse = {
  id: string
  email: string
  nom?: string
  trigramme?: string
  taux?: number
  iban?: string
  bic?: string
  raisonSociale?: string
}

type Vente = {
  id: string
  chineur?: string
  trigramme?: string
  prixVenteReel?: number
  prix?: number
  dateVente?: any
  sku?: string
  source?: string
  venteFamiliale?: boolean
}

type PaiementStatus = {
  factureRecue: boolean
  paye: boolean
  datePaiement?: Timestamp
  montant?: number
}

export default function AdminPaiementsPage() {
  const [chineuses, setChineuses] = useState<Chineuse[]>([])
  const [ventes, setVentes] = useState<Vente[]>([])
  const [statuts, setStatuts] = useState<Record<string, PaiementStatus>>({})
  const [loading, setLoading] = useState(true)
  const [moisSelectionne, setMoisSelectionne] = useState(() => {
    const now = new Date()
    return `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`
  })

  const moisLabel = useMemo(() => {
    const [m, y] = moisSelectionne.split('-').map(Number)
    return format(new Date(y, m - 1), 'MMMM yyyy', { locale: fr })
  }, [moisSelectionne])

  // Mois disponibles (6 derniers mois)
  const moisDisponibles = useMemo(() => {
    const result = []
    const now = new Date()
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const val = `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
      result.push({ value: val, label: format(d, 'MMMM yyyy', { locale: fr }) })
    }
    return result
  }, [])

  // Fetch chineuses via route cachée (au lieu d'onSnapshot sur la collection).
  useEffect(() => {
    let cancelled = false
    fetch('/api/chineuses-lite')
      .then(r => (r.ok ? r.json() : []))
      .then((list: any[]) => {
        if (cancelled) return
        setChineuses(Array.isArray(list) ? list.map(c => ({ id: c.uid, ...c })) : [])
      })
      .catch(err => console.error('[admin/paiements] chineuses load:', err))
    return () => {
      cancelled = true
    }
  }, [])

  // Fetch ventes via /api/ventes (auth admin + limit 5000 + filtre 24 derniers
  // mois côté serveur). Remplace onSnapshot sur toute la collection ventes
  // (potentiellement 10k+ docs par montage).
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const token = await auth.currentUser?.getIdToken()
        const res = await fetch('/api/ventes', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        const data = res.ok ? await res.json() : { ventes: [] }
        if (cancelled) return
        setVentes(Array.isArray(data.ventes) ? data.ventes : [])
      } catch (err) {
        console.error('[admin/paiements] ventes load:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'paiements', moisSelectionne, 'statuts'),
      (snap) => {
        const data: Record<string, PaiementStatus> = {}
        snap.docs.forEach(d => { data[d.id] = d.data() as PaiementStatus })
        setStatuts(data)
      }
    )
    return () => unsub()
  }, [moisSelectionne])

  const getPrix = (v: Vente) =>
    typeof v.prixVenteReel === 'number' ? v.prixVenteReel : (v.prix || 0)

  const getDateFromVente = (v: Vente): Date => {
    if (v.dateVente && typeof v.dateVente.toDate === 'function') return v.dateVente.toDate()
    if (typeof v.dateVente === 'string') return new Date(v.dateVente)
    return new Date()
  }

  // Calcul net dû par chineuse pour le mois sélectionné
  const paiementsParChineuse = useMemo(() => {
    const [m, y] = moisSelectionne.split('-').map(Number)
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 0, 23, 59, 59, 999)

    return chineuses.map(ch => {
      const ventesDuMois = ventes.filter(v => {
        if (v.chineur !== ch.email && v.trigramme !== ch.trigramme) return false
        const d = getDateFromVente(v)
        return d >= start && d <= end
      })
      const ca = ventesDuMois.reduce((s, v) => s + getPrix(v), 0)
      const caFamiliale = ventesDuMois
        .filter(v => v.venteFamiliale === true || v.source === 'familiale')
        .reduce((s, v) => s + getPrix(v), 0)
      const taux = typeof ch.taux === 'number' ? ch.taux / 100 : 0.40
      const commissionHT = ca * taux
      const tva = commissionHT * 0.2
      const commissionTTC = commissionHT * 1.2
      const net = ca - commissionTTC
      const ref = `NR${String(m).padStart(2, '0')}${String(y).slice(-2)}-${(ch.trigramme || '').toUpperCase()}`
      return { chineuse: ch, ca, caFamiliale, net, tva, taux, ref, nbVentes: ventesDuMois.length }
    }).filter(p => p.nbVentes > 0)
  }, [chineuses, ventes, moisSelectionne])

  const toggleFactureRecue = async (chineumseId: string, current: boolean) => {
    await setDoc(doc(db, 'paiements', moisSelectionne, 'statuts', chineumseId), {
      factureRecue: !current,
      paye: statuts[chineumseId]?.paye || false,
    }, { merge: true })
  }

  const PENNYLANE_COMPANY_ID = '22358154'

  const markPaidApi = async (items: { chineuseId: string; montant: number }[]) => {
    const res = await fetch('/api/paiements/mark-paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mois: moisSelectionne, items }),
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error || 'Erreur API')
    return json
  }


  const totalDu = paiementsParChineuse.reduce((s, p) => s + p.net, 0)
  const totalPaye = paiementsParChineuse.filter(p => statuts[p.chineuse.id]?.paye).reduce((s, p) => s + p.net, 0)
  const totalTva = paiementsParChineuse.reduce((s, p) => s + p.tva, 0)
  const totalCa = paiementsParChineuse.reduce((s, p) => s + p.ca, 0)
  const totalCaFamiliale = paiementsParChineuse.reduce((s, p) => s + p.caFamiliale, 0)
  const totalCaSquare = totalCa - totalCaFamiliale

  const exporterSepaXML = () => {
    const aExporter = paiementsParChineuse.filter(p => {
      const s = statuts[p.chineuse.id]
      return s?.factureRecue && !s?.paye && p.chineuse.iban
    })
    if (aExporter.length === 0) {
      alert('Aucun paiement à exporter (facture reçue + non payé + IBAN renseigné)')
      return
    }

    const now = new Date()
    const msgId = `NR-${moisSelectionne}-${now.getTime()}`
    const dateISO = now.toISOString().split('.')[0]
    const totalAmount = aExporter.reduce((s, p) => s + p.net, 0)

    const stripAccents = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

    const transactions = aExporter.map((p) => {
      const iban = (p.chineuse.iban || '').replace(/\s/g, '')
      const bic = (p.chineuse.bic || '').replace(/\s/g, '')
      const nom = stripAccents((p.chineuse.raisonSociale || p.chineuse.nom || p.chineuse.email || '')).slice(0, 70)
      return `
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>${p.ref}</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="EUR">${p.net.toFixed(2)}</InstdAmt>
        </Amt>
        ${bic ? `<CdtrAgt><FinInstnId><BIC>${bic}</BIC></FinInstnId></CdtrAgt>` : ''}
        <Cdtr>
          <Nm>${nom}</Nm>
        </Cdtr>
        <CdtrAcct>
          <Id><IBAN>${iban}</IBAN></Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>${p.ref}</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>`
    }).join('')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${dateISO}</CreDtTm>
      <NbOfTxs>${aExporter.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <InitgPty>
        <Nm>NR1 SAS</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${msgId}-001</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <NbOfTxs>${aExporter.length}</NbOfTxs>
      <CtrlSum>${totalAmount.toFixed(2)}</CtrlSum>
      <PmtTpInf>
        <SvcLvl><Cd>SEPA</Cd></SvcLvl>
      </PmtTpInf>
      <ReqdExctnDt>${now.toISOString().split('T')[0]}</ReqdExctnDt>
      <Dbtr>
        <Nm>NR1 SAS</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id><IBAN>FR7617418000010001189894769</IBAN></Id>
      </DbtrAcct>
      <DbtrAgt>
        <FinInstnId><BIC>SNNNFR22XXX</BIC></FinInstnId>
      </DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>${transactions}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`

    const blob = new Blob([xml], { type: 'application/xml' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `virements_${moisSelectionne}.xml`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const marquerPaye = async (chineuseId: string, montant: number) => {
    try {
      await markPaidApi([{ chineuseId, montant }])
    } catch (e: any) {
      alert(`Erreur : ${e?.message || e}`)
    }
  }

  const ouvrirPennylane = async (ref: string) => {
    try { await navigator.clipboard.writeText(ref) } catch {}
    window.open(`https://app.pennylane.com/companies/${PENNYLANE_COMPANY_ID}/clients/transactions`, '_blank', 'noopener')
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#22209C]" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Paiements</h1>
        <select
          value={moisSelectionne}
          onChange={e => setMoisSelectionne(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          {moisDisponibles.map(m => (
            <option key={m.value} value={m.value}>
              {m.label.charAt(0).toUpperCase() + m.label.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
          <span className="text-orange-600 font-semibold">{formatPrix(totalDu)} €</span>
          <span className="text-orange-500 ml-1 text-sm">total dû</span>
        </div>
        <div className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
          <span className="text-green-600 font-semibold">{formatPrix(totalPaye)} €</span>
          <span className="text-green-500 ml-1 text-sm">payé</span>
        </div>
        <div className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-red-600 font-semibold">{formatPrix(totalDu - totalPaye)} €</span>
          <span className="text-red-500 ml-1 text-sm">restant</span>
        </div>
        <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-blue-600 font-semibold">{formatPrix(totalTva)} €</span>
          <span className="text-blue-500 ml-1 text-sm">TVA collectée</span>
        </div>
        {totalCaFamiliale > 0 && (
          <div className="px-3 py-1.5 bg-pink-50 border border-pink-200 rounded-lg">
            <span className="text-pink-600 font-semibold">{formatPrix(totalCaFamiliale)} €</span>
            <span className="text-pink-500 ml-1 text-sm">
              CA familial
              <span className="text-pink-400"> · Square : {formatPrix(totalCaSquare)} €</span>
            </span>
          </div>
        )}
        <button
          onClick={exporterSepaXML}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-[#22209C] text-white rounded-lg text-sm font-medium hover:bg-[#1a1878] transition-colors"
        >
          <Download size={16} />
          Exporter SEPA XML
        </button>
      </div>

      {/* Liste */}
      {paiementsParChineuse.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-400">Aucune vente pour {moisLabel}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Chineuse</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">CA</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">TVA collectée</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Net à payer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Réf. facture</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Facture reçue</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {paiementsParChineuse.map(({ chineuse, ca, caFamiliale, net, tva, taux, ref, nbVentes }) => {
                const statut = statuts[chineuse.id] || { factureRecue: false, paye: false }
                return (
                  <tr
                    key={chineuse.id}
                    className={`border-b border-gray-100 ${statut.paye ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{(chineuse.nom || chineuse.email || '').toUpperCase()}</div>
                      <div className="text-xs text-gray-400">{nbVentes} vente{nbVentes > 1 ? 's' : ''}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      <div>{formatPrix(ca, { decimals: 2 })} €</div>
                      {caFamiliale > 0 && (
                        <div className="text-xs text-pink-500">
                          dont familial {formatPrix(caFamiliale, { decimals: 2 })} €
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600">
                      <div>{formatPrix(tva, { decimals: 2 })} €</div>
                      <div className="text-xs text-gray-400">marge {Math.round(taux * 100)}%</div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatPrix(net, { decimals: 2 })} €</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{ref}</td>
                    <td className="px-4 py-3 text-center">
                      {statut.paye ? (
                        <button
                          onClick={() => marquerPaye(chineuse.id, net)}
                          className="flex items-center gap-1.5 mx-auto px-2.5 py-1 rounded-lg text-xs font-medium bg-green-500 text-white border border-green-600"
                          title={`Payé ${statut.datePaiement ? format(statut.datePaiement.toDate(), 'dd/MM', { locale: fr }) : ''}`}
                        >
                          <CheckCircle size={13} /> Payé {statut.datePaiement ? format(statut.datePaiement.toDate(), 'dd/MM', { locale: fr }) : ''}
                        </button>
                      ) : statut.factureRecue ? (
                        <button
                          onClick={() => marquerPaye(chineuse.id, net)}
                          className="flex items-center gap-1.5 mx-auto px-2.5 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700 border border-green-200 hover:bg-green-200"
                          title="Cliquer pour marquer comme payé"
                        >
                          <CheckCircle size={13} /> Reçue
                        </button>
                      ) : (
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            onClick={() => toggleFactureRecue(chineuse.id, statut.factureRecue)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200"
                            title="Cliquer pour marquer la facture comme reçue"
                          >
                            <Mail size={13} /> En attente
                          </button>
                          <button
                            onClick={() => { if (confirm('Marquer comme payé sans facture reçue ?')) marquerPaye(chineuse.id, net) }}
                            className="flex items-center justify-center w-6 h-6 rounded-lg text-xs font-medium bg-green-100 text-green-700 border border-green-200 hover:bg-green-200"
                            title="Marquer directement comme payé (hors flow facture)"
                          >
                            <CheckCircle size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => ouvrirPennylane(ref)}
                        className="flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg text-xs font-medium bg-[#22209C] text-white hover:bg-[#1a1878]"
                        title={`Ouvre Pennylane (ref ${ref} copiée)`}
                      >
                        <ExternalLink size={13} />
                        Pennylane
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}