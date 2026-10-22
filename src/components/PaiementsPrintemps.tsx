// components/PaiementsPrintemps.tsx
// Bloc Printemps de la page Paiements : séparé du bloc NR, qui ne change pas.
// Net à payer = montant de la facture PRI (lib/facturePrintemps).
'use client'

import { useEffect, useMemo, useState } from 'react'
import { auth, db } from '@/lib/firebaseConfig'
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore'
import { CheckCircle, Download, Mail } from 'lucide-react'
import { formatPrix } from '@/lib/formatPrix'
import { genererSepaXml, telechargerXml } from '@/lib/sepaXml'
import { montantsFacturePrintemps } from '@/lib/facturePrintemps'
import { PROPRIETAIRES_PRINTEMPS, TRIGRAMME_PROPRIETAIRE } from '@/lib/ventesPrintemps'

type Chineuse = { id: string; email: string; nom?: string; trigramme?: string; iban?: string; bic?: string; raisonSociale?: string }
type VentePRI = { prix: number; proprietaire: string; canal: string; dateVente: string }

// GIGI PARIS est une marque de NR1 SAS : pas de virement à soi-même.
const SANS_VIREMENT = ['GIGI']

export default function PaiementsPrintemps({ mois, chineuses }: { mois: string; chineuses: Chineuse[] }) {
  const [ventes, setVentes] = useState<VentePRI[]>([])
  const [recues, setRecues] = useState<Record<string, boolean>>({})
  const [relectures, setRelectures] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await auth.currentUser?.getIdToken()
      if (!token) return
      const res = await fetch(`/api/ventes-printemps?mois=${mois}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = res.ok ? await res.json() : { ventes: [] }
      if (!cancelled) { setVentes(data.ventes || []); setRelectures(data.relecturesMois || {}) }
    })().catch(err => console.error('[paiements PRI] ventes:', err))
    return () => { cancelled = true }
  }, [mois])

  // Statut « facture reçue » PRI rangé à part du NR : paiements/{mois}/statutsPRI/{trigramme}
  useEffect(() => {
    return onSnapshot(collection(db, 'paiements', mois, 'statutsPRI'), snap => {
      const r: Record<string, boolean> = {}
      snap.docs.forEach(d => { r[d.id] = d.data().factureRecue === true })
      setRecues(r)
    })
  }, [mois])

  const [m, y] = mois.split('-')
  const lignes = useMemo(() => PROPRIETAIRES_PRINTEMPS.map(proprietaire => {
    const trigramme = TRIGRAMME_PROPRIETAIRE[proprietaire]
    const siennes = ventes.filter(v => v.proprietaire === proprietaire)
    const { total } = montantsFacturePrintemps(
      siennes.map(v => ({ prix: v.prix, canal: v.canal, date: new Date(v.dateVente) })), trigramme)
    return {
      proprietaire,
      trigramme,
      chineuse: chineuses.find(c => (c.trigramme || '').toUpperCase() === trigramme),
      ca: siennes.reduce((s, v) => s + v.prix, 0),
      net: total,
      ref: `PRI${m}${y.slice(-2)}-${trigramme}`,
    }
  }), [ventes, chineuses, m, y])

  const basculerRecue = (trigramme: string) =>
    setDoc(doc(db, 'paiements', mois, 'statutsPRI', trigramme), { factureRecue: !recues[trigramme] }, { merge: true })

  const exporterSepa = () => {
    const aExporter = lignes.filter(l => recues[l.trigramme] && l.net > 0 && l.chineuse?.iban && !SANS_VIREMENT.includes(l.trigramme))
    if (aExporter.length === 0) {
      alert('Aucun paiement PRI à exporter (facture reçue + IBAN renseigné)')
      return
    }
    const xml = genererSepaXml(`PRI-${mois}-${Date.now()}`, aExporter.map(l => ({
      ref: l.ref,
      montant: l.net,
      iban: l.chineuse!.iban || '',
      bic: l.chineuse!.bic,
      nom: l.chineuse!.raisonSociale || l.chineuse!.nom || l.chineuse!.email || '',
    })))
    telechargerXml(xml, `virements_PRI_${mois}.xml`)
  }

  return (
    <div className="space-y-4 pt-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Relecture des ventes du mois par chineuse : on paie après validation */}
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>Ventes relues :</span>
          {lignes.filter(l => !SANS_VIREMENT.includes(l.trigramme)).map(l => (
            <span key={l.trigramme} className="flex items-center gap-1" title={relectures[l.trigramme] ? 'Ventes du mois validées' : 'Pas encore validées'}>
              <span className={`w-3 h-3 rounded-full ${relectures[l.trigramme] ? 'bg-green-500' : 'bg-red-500'}`} />
              {l.trigramme}
            </span>
          ))}
        </div>
        <button onClick={exporterSepa} className="flex items-center gap-2 px-4 py-2 bg-[#22209C] text-white rounded-lg text-sm font-medium hover:bg-[#1a1878]">
          <Download size={16} />
          Exporter SEPA XML PRI
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Chineuses PRI</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">CA printemps TTC</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Net à payer</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Réf. facture</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Facture reçue</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(l => (
                <tr key={l.proprietaire} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{l.proprietaire}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatPrix(l.ca, { decimals: 2 })} €</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatPrix(l.net, { decimals: 2 })} €</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{l.ref}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => basculerRecue(l.trigramme)}
                      className={`flex items-center gap-1.5 mx-auto px-2.5 py-1 rounded-lg text-xs font-medium border ${recues[l.trigramme]
                        ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'}`}
                    >
                      {recues[l.trigramme] ? <><CheckCircle size={13} /> Reçue</> : <><Mail size={13} /> En attente</>}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
