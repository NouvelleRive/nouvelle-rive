'use client'

import { useState, useEffect, useMemo } from 'react'
import { db } from '@/lib/firebaseConfig'
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

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'chineuse'), (snap) => {
      setChineuses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Chineuse)))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'ventes'), (snap) => {
      setVentes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vente)))
      setLoading(false)
    })
    return () => unsub()
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
      const taux = typeof ch.taux === 'number' ? ch.taux / 100 : 0.40
      const commissionTTC = ca * taux * 1.2
      const net = ca - commissionTTC
      const ref = `NR${String(m).padStart(2, '0')}${String(y).slice(-2)}-${(ch.trigramme || '').toUpperCase()}`
      return { chineuse: ch, ca, net, ref, nbVentes: ventesDuMois.length }
    }).filter(p => p.nbVentes > 0)
  }, [chineuses, ventes, moisSelectionne])

  const toggleFactureRecue = async (chineumseId: string, current: boolean) => {
    await setDoc(doc(db, 'paiements', moisSelectionne, 'statuts', chineumseId), {
      factureRecue: !current,
      paye: statuts[chineumseId]?.paye || false,
    }, { merge: true })
  }

  const marquerPaye = async (chineumseId: string, montant: number) => {
    if (!confirm('Confirmer le paiement ?')) return
    await setDoc(doc(db, 'paiements', moisSelectionne, 'statuts', chineumseId), {
      factureRecue: true,
      paye: true,
      datePaiement: Timestamp.now(),
      montant,
    }, { merge: true })
  }

  const totalDu = paiementsParChineuse.reduce((s, p) => s + p.net, 0)
  const totalPaye = paiementsParChineuse.filter(p => statuts[p.chineuse.id]?.paye).reduce((s, p) => s + p.net, 0)

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

    const transactions = aExporter.map((p) => {
      const iban = (p.chineuse.iban || '').replace(/\s/g, '')
      const bic = (p.chineuse.bic || '').replace(/\s/g, '')
      const nom = (p.chineuse.raisonSociale || p.chineuse.nom || p.chineuse.email || '').slice(0, 70)
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
          <span className="text-orange-600 font-semibold">{totalDu.toFixed(2)}€</span>
          <span className="text-orange-500 ml-1 text-sm">total dû</span>
        </div>
        <div className="px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
          <span className="text-green-600 font-semibold">{totalPaye.toFixed(2)}€</span>
          <span className="text-green-500 ml-1 text-sm">payé</span>
        </div>
        <div className="px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-red-600 font-semibold">{(totalDu - totalPaye).toFixed(2)}€</span>
          <span className="text-red-500 ml-1 text-sm">restant</span>
        </div>
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
                <th className="text-right px-4 py-3 font-medium text-gray-600">Net à payer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Réf. facture</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Facture reçue</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {paiementsParChineuse.map(({ chineuse, ca, net, ref, nbVentes }) => {
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
                    <td className="px-4 py-3 text-right text-gray-600">{ca.toFixed(2)}€</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{net.toFixed(2)}€</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{ref}</td>
                    <td className="px-4 py-3 text-center">
                      {statut.paye ? (
                        <CheckCircle size={18} className="inline text-green-500" />
                      ) : (
                        <button
                          onClick={() => toggleFactureRecue(chineuse.id, statut.factureRecue)}
                          className={`flex items-center gap-1.5 mx-auto px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                            statut.factureRecue
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : 'bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200'
                          }`}
                        >
                          {statut.factureRecue ? (
                            <><CheckCircle size={13} /> Reçue</>
                          ) : (
                            <><Mail size={13} /> En attente</>
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {statut.paye ? (
                        <span className="text-xs text-green-600 font-medium">
                          Payé {statut.datePaiement ? format(statut.datePaiement.toDate(), 'dd/MM', { locale: fr }) : ''}
                        </span>
                      ) : (
                        <button
                          onClick={() => marquerPaye(chineuse.id, net)}
                          disabled={!statut.factureRecue}
                          className={`flex items-center gap-1.5 mx-auto px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            statut.factureRecue
                              ? 'bg-[#22209C] text-white hover:bg-[#1a1878]'
                              : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                          }`}
                        >
                          <ExternalLink size={13} />
                          Payer via Pennylane
                        </button>
                      )}
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