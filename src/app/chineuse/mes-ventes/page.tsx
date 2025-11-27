  'use client'

  import { useEffect, useMemo, useState } from 'react'
  import { useRouter } from 'next/navigation'
  import { User, onAuthStateChanged } from 'firebase/auth'
  import {
    collection, getDocs, getDoc, doc, query, where, Timestamp,
  } from 'firebase/firestore'
  import { auth, db } from '@/lib/firebaseConfig'
  import { format } from 'date-fns'
  import { fr } from 'date-fns/locale'
  import jsPDF from 'jspdf'

  type Vente = {
    id: string
    nom?: string
    description?: string
    categorie?: any
    prix?: number
    prixVenteReel?: number
    dateVente?: Timestamp | string
    chineur?: string
  }

  type ChineuseMeta = {
    nom?: string
    commissionHT?: number // ex: 0.40
    siret?: string
    adresse1?: string
    adresse2?: string
    tva?: string
    iban?: string
    bic?: string
    banqueAdresse?: string
    codeChineuse?: string
    code?: string
    // on tolère des variantes de clés via fallbacks dans le PDF
  }

  const PRIMARY = '#22209C'

  export default function MesVentesPage() {
    const router = useRouter()
    const [user, setUser] = useState<User | null>(null)
    const [ventes, setVentes] = useState<Vente[]>([])
    const [chineuse, setChineuse] = useState<ChineuseMeta | null>(null)

    // Filtres
    const [tri, setTri] = useState<'date' | 'nom' | 'prix'>('date')
    const [moisFiltre, setMoisFiltre] = useState<string>('') // "MM-YYYY"
    const [filtreCategorie, setFiltreCategorie] = useState<string>('')

    // Sync + téléchargement
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [loadingSync, setLoadingSync] = useState(false)
    const [syncMessage, setSyncMessage] = useState('')
    const [showMonthSelect, setShowMonthSelect] = useState(false)


    useEffect(() => {
      const unsub = onAuthStateChanged(auth, async (u) => {
        if (!u) { router.push('/login'); return }
        setUser(u)
        
        // 🆕 Afficher l'UID dans la console pour debug
        console.log('🔑 Mon UID:', u.uid)
        console.log('📧 Mon email:', u.email)

        // Profil chineuse (commission + infos facturation)
        const chineuseSnap = await getDoc(doc(db, 'chineuse', u.uid))
        setChineuse(chineuseSnap.exists() ? (chineuseSnap.data() as any) : {})

        await fetchVentes(u.uid, u.email!)
      })
      return () => unsub()
    }, [router])

    async function fetchVentes(uid: string, email: string) {
      const conditions = [ where('chineur', '==', email), where('vendu', '==', true) ]
      const q = query(collection(db, 'produits'), ...conditions)
      const snap = await getDocs(q)
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Vente[]
      setVentes(data)
      console.log(`📊 ${data.length} ventes trouvées dans Firestore`)
    }

    async function handleSyncVentes() {
      if (!user) return
      setLoadingSync(true); setSyncMessage('')
      try {
        const res = await fetch('/api/sync-ventes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: user.uid,
            startDateStr: startDate ? `${startDate}T00:00:00Z` : undefined,
            endDateStr: endDate ? `${endDate}T23:59:59Z` : undefined,
          }),
        })
        const data = await res.json()
        if (data.success) {
          setSyncMessage('Synchronisation réussie !')
          await fetchVentes(user.uid, user.email!)
        } else {
          setSyncMessage(`Erreur : ${data.error}`)
        }
      } catch (e: any) {
        setSyncMessage(`Erreur : ${e.message}`)
      }
      setLoadingSync(false)
    }
    // Mois dispos
    const moisDisponibles = useMemo(() => {
      const set = new Set<string>()
      ventes.forEach(v => {
        const d = v.dateVente instanceof Timestamp ? v.dateVente.toDate() : new Date(v.dateVente as any)
        if (isNaN(d.getTime())) return
        set.add(`${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`)
      })
      return Array.from(set)
        .map(v => {
          const [m, y] = v.split('-').map(Number)
          const d = new Date(y, m - 1)
          return { value: v, label: format(d, 'MMMM yyyy', { locale: fr }) }
        })
        .sort((a, b) => {
          const [mA, yA] = a.value.split('-').map(Number)
          const [mB, yB] = b.value.split('-').map(Number)
          return new Date(yB, mB - 1).getTime() - new Date(yA, mA - 1).getTime()
        })
    }, [ventes])

    // Catégories dispos
    const categoriesDisponibles = useMemo(() => {
      const set = new Set<string>()
      ventes.forEach(v => {
        const cat = typeof v.categorie === 'object' ? v.categorie?.label : v.categorie
        if (cat) set.add(cat)
      })
      return Array.from(set)
    }, [ventes])

    // Filtrage
    const ventesFiltrees = useMemo(() => {
      return ventes.filter(v => {
        const d = v.dateVente instanceof Timestamp ? v.dateVente.toDate() : new Date(v.dateVente as any)
        const key = isNaN(d.getTime()) ? '' : `${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
        if (moisFiltre && key !== moisFiltre) return false
        if (filtreCategorie) {
          const cat = typeof v.categorie === 'object' ? v.categorie?.label : v.categorie
          if (cat !== filtreCategorie) return false
        }
        return true
      })
    }, [ventes, moisFiltre, filtreCategorie])

    // Tri
    const ventesTriees = useMemo(() => {
      const arr = [...ventesFiltrees]
      if (tri === 'nom') arr.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''))
      if (tri === 'prix') {
        const p = (x: Vente) => (typeof x.prixVenteReel === 'number' ? x.prixVenteReel : (x.prix || 0))
        arr.sort((a, b) => p(b) - p(a))
      }
      if (tri === 'date') {
        const t = (x: Vente) => {
          const d = x.dateVente instanceof Timestamp ? x.dateVente.toDate() : new Date(x.dateVente as any)
          return d.getTime()
        }
        arr.sort((a, b) => t(b) - t(a))
      }
      return arr
    }, [ventesFiltrees, tri])

    // Résumé
    const resume = useMemo(() => {
      const nb = ventesTriees.length
      const ca = ventesTriees.reduce((s, v) => s + (typeof v.prixVenteReel === 'number' ? v.prixVenteReel : (v.prix || 0)), 0)
      return { nb, ca }
    }, [ventesTriees])

    // Export CSV
    function exportCSV() {
      const rows = [
        ['Nom', 'Description', 'Catégorie', 'Prix (€)', 'Date de vente'],
        ...ventesTriees.map(v => {
          const cat = typeof v.categorie === 'object' ? v.categorie?.label : v.categorie
          const prix = (typeof v.prixVenteReel === 'number' ? v.prixVenteReel : (v.prix || 0))
          const date = v.dateVente instanceof Timestamp ? v.dateVente.toDate() : new Date(v.dateVente as any)
          return [
            v.nom || '',
            v.description || '',
            cat || '',
            prix.toString().replace('.', ','),
            isNaN(date.getTime()) ? '' : format(date, 'dd/MM/yyyy')
          ]
        })
      ]
      const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'ventes.csv'
      a.click()
    }

    function getVendorCode(ch: any | null, ventesDuMois: any[]): string {
      const direct = (ch?.codeChineuse || ch?.code || '').toString().trim()
      if (direct) return direct.toUpperCase()

      const label = ventesDuMois.find(v => v?.categorie)?.categorie
      const raw =
        typeof label === 'object' && label?.label
          ? label.label
          : typeof label === 'string'
            ? label
            : ''
      if (raw.includes(' - ')) return raw.split(' - ')[0].trim().toUpperCase()

      const nom = (ch?.nom || '').toString().trim()
      if (nom) return nom.split(/\s+/)[0].toUpperCase()
      return 'NR'
    }

    function generateInvoiceFor(monthValue: string) {
      if (!user) return
      const [m, y] = monthValue.split('-').map(Number)
      const start = new Date(y, m - 1, 1)
      const end = new Date(y, m, 0, 23, 59, 59, 999)

      const ventesDuMois = ventes.filter(v => {
        const d = v.dateVente instanceof Timestamp ? v.dateVente.toDate() : new Date(v.dateVente as any)
        return d >= start && d <= end
      })

      const ca = ventesDuMois.reduce((s, v) => s + (typeof v.prixVenteReel === 'number' ? v.prixVenteReel : (v.prix || 0)), 0)
      const tauxHT = typeof chineuse?.commissionHT === 'number' ? chineuse!.commissionHT : 0.40
      const commissionHT = ca * tauxHT
      const commissionTTC = commissionHT * 1.2
      const tva = commissionTTC - commissionHT
      const net = ca - commissionTTC

      const code = getVendorCode(chineuse, ventesDuMois)
      const ref = `NR${String(m).padStart(2,'0')}${String(y).slice(-2)}-${code}`

      const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
      const fmtEUR = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

      const docPDF = new jsPDF({ unit: 'pt', format: 'a4' })
      const pageW = docPDF.internal.pageSize.getWidth()
      const margin = 32
      const contentW = pageW - margin * 2
      const leftW = contentW * (2 / 3)
      const rightX = margin + leftW + 16

      // Police 10 partout ; gras uniquement pour le nom chineuse
      docPDF.setFontSize(10)

      // --- En-tête gauche : Chineuse ---
      docPDF.setFont('helvetica', 'bold')
      docPDF.text((chineuse?.nom || user.email || '').toUpperCase(), margin, 52)

      docPDF.setFont('helvetica', 'normal')

      // fallbacks pour SIRET / adresses / TVA
      const siret =
        (chineuse as any)?.siret ||
        (chineuse as any)?.SIRET ||
        (chineuse as any)?.siren ||
        (chineuse as any)?.siretNumber ||
        ''
      const ad1 =
        (chineuse as any)?.adresse1 ||
        (chineuse as any)?.adresse ||
        (chineuse as any)?.address1 ||
        ''
      const ad2 =
        (chineuse as any)?.adresse2 ||
        (chineuse as any)?.address2 ||
        ''
      const tvaNum =
        (chineuse as any)?.tva ||
        (chineuse as any)?.TVA ||
        (chineuse as any)?.numeroTVA ||
        (chineuse as any)?.numTVA ||
        ''

      let yLeft = 68
      ;[
        siret && `SIRET ${siret}`,
        ad1,
        ad2,
        tvaNum && `TVA ${tvaNum}`,
      ].filter(Boolean).forEach((line: string) => {
        docPDF.text(line, margin, yLeft)
        yLeft += 16
      })

      // --- En-tête droite : NR1 ---
      docPDF.text('NR1 SAS', rightX, 52)
      docPDF.setTextColor(34,32,156)
      docPDF.text('941 895 203 00011', rightX, 68)
      docPDF.setTextColor(0,0,0)

      const rightBlock = ['5 route du Grand Pont','78110 Le Vésinet','FR5894189520']
      let yRight = 84
      rightBlock.forEach((t) => {
        docPDF.text(t, rightX, yRight)
        yRight += 16
      })
      yRight -= 16 // dernière ligne effectivement dessinée

      // --- Séparation claire : infos facture toujours sous les blocs société ---
      const headerBottom = Math.max(yLeft, yRight) + 24 // marge de sécurité
      const yMetaTop = headerBottom

      // Réf & période (mois sélectionné)
      const periodeTxt = format(start, 'LLLL yyyy', { locale: fr })
      docPDF.text('Ref facture', margin, yMetaTop);          docPDF.text(ref,         margin + 110, yMetaTop)
      docPDF.text('Période',    margin, yMetaTop + 16);      docPDF.text(periodeTxt, margin + 110, yMetaTop + 16)

      // Bandeau titres
      const yHead = yMetaTop + 46 // ancien 170 → maintenant dynamique, sous le méta-bloc
      const hHead = 36
      docPDF.setFillColor(34,32,156)
      docPDF.rect(margin, yHead, contentW, hHead, 'F')

      type Col = { lines: string[]; width: number; align?: 'left'|'right' }
      const cols: Col[] = [
        { lines: ['Descriptif'],            width: contentW * 0.40, align: 'left' },
        { lines: ["Prix de l'article"],     width: contentW * 0.14, align: 'right' },
        { lines: ['Commission','NR HT'],    width: contentW * 0.14, align: 'right' },
        { lines: ['Commission','NR TTC'],   width: contentW * 0.14, align: 'right' },
        { lines: ['TVA'],                   width: contentW * 0.08, align: 'right' },
        { lines: ['Net à nous','devoir'],   width: contentW * 0.10, align: 'right' },
      ]

      // Titres (blanc)
      docPDF.setTextColor(255,255,255)
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
      docPDF.setTextColor(0,0,0)

      // Ligne valeurs (résumé)
      const rowY = yHead + hHead + 22
      const values = [
        'Lot de pièces vintage',
        fmt(ca),
        fmt(commissionHT),
        fmt(commissionTTC),
        fmt(tva),
        fmt(net),
      ]

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

      // À payer
      const yPay = rowY + 42
      docPDF.text('À payer', margin, yPay)
      docPDF.text(fmtEUR(net), margin, yPay + 16)

      // Coordonnées bancaires
      const yBank = yPay + 56
      docPDF.text('IBAN', margin, yBank);                docPDF.text(chineuse?.iban || 'xxx', margin + 120, yBank)
      docPDF.text('BIC', margin, yBank + 16);            docPDF.text(chineuse?.bic || 'xxx', margin + 120, yBank + 16)
      docPDF.text('Adresse Banque', margin, yBank + 32); docPDF.text(chineuse?.banqueAdresse || 'xxx', margin + 120, yBank + 32)

      docPDF.save(`facture_${ref}.pdf`)
    }

    return (
      <>
        <main className="max-w-6xl mx-auto p-6">
          <h1 className="text-3xl font-bold text-center text-primary uppercase mb-6">
            MES VENTES CHEZ NOUVELLE RIVE
          </h1>

          {/* Bandeau Filtrer / Télécharger (2/3 – 1/3) */}
          <div className="grid grid-cols-3 gap-6 mb-6">
            {/* FILTRER */}
            <section className="col-span-2 bg-white border rounded-2xl p-5 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Filtrer</h2>

              <div className="grid lg:grid-cols-3 md:grid-cols-2 grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Mois</label>
                  <select
                    value={moisFiltre}
                    onChange={(e) => setMoisFiltre(e.target.value)}
                    className="w-full border rounded px-3 py-2"
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
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="">Toutes</option>
                    {categoriesDisponibles.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Trier par</label>
                  <select
                    value={tri}
                    onChange={(e) => setTri(e.target.value as any)}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="date">Date</option>
                    <option value="nom">Nom</option>
                    <option value="prix">Prix</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Début (sync)</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fin (sync)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleSyncVentes}
                    disabled={loadingSync}
                    className="w-full rounded px-4 py-2 text-white"
                    style={{ background: PRIMARY, opacity: loadingSync ? 0.6 : 1 }}
                  >
                    {loadingSync ? 'Synchronisation…' : 'Recevoir de la caisse'}
                  </button>
                </div>
              </div>

              {syncMessage && (
                <p className="text-sm text-gray-600 mt-3 whitespace-pre-line bg-gray-50 p-3 rounded">
                  {syncMessage}
                </p>
              )}
            </section>

            {/* TÉLÉCHARGER */}
            <section className="col-span-1  bg-white border rounded-2xl p-5 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Télécharger</h2>

              <div className="flex flex-col gap-3">
                <button
                  onClick={exportCSV}
                  className="rounded px-4 py-2 text-white"
                  style={{ background: PRIMARY }}
                >
                  Ventes en CSV
                </button>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setShowMonthSelect(s => !s)}
                    className="rounded px-4 py-2 text-white"
                    style={{ background: PRIMARY }}
                  >
                    Facture en PDF
                  </button>

                  {showMonthSelect && (
                    <select
                      onChange={(e) => {
                        const val = e.target.value
                        if (val) generateInvoiceFor(val)
                      }}
                      defaultValue=""
                      className="w-full border rounded px-3 py-2"
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

                <p className="text-xs text-gray-600">
                  La facture est à retourner par mail à l'adresse nouvelleriveparis@gmail.com
                </p>
              </div>
            </section>
          </div>

          {/* Résumé & Ventes */}
          <div className="mb-3">
            <h2 className="text-xl font-semibold">Ventes</h2>
            <p className="text-sm text-gray-700 mt-1">
              Total CA :{' '}
              <span className="font-semibold">
                {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(resume.ca)}
              </span>{' '}
              — {resume.nb} pièce{resume.nb > 1 ? 's' : ''}
            </p>
          </div>

          <div className="space-y-6">
            {ventesTriees.map((v) => {
              const date = v.dateVente instanceof Timestamp ? v.dateVente.toDate() : new Date(v.dateVente as any)
              const cat = typeof v.categorie === 'object' && v.categorie?.label ? v.categorie.label : (v.categorie || '—')
              const prix = typeof v.prixVenteReel === 'number' ? v.prixVenteReel : (v.prix || 0)
              return (
                <div key={v.id} className="border p-4 bg-white rounded-md shadow-sm grid grid-cols-4 gap-4 items-start">
                  <div className="col-span-2">
                    <p className="font-semibold text-lg">{v.nom}</p>
                    {v.description && <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{v.description}</p>}
                    <p className="text-xs text-gray-400 mt-2">
                      Vendu le {isNaN(date.getTime()) ? '—' : format(date, 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <div className="text-sm">
                    <p><span className="text-gray-700">Catégorie :</span> <span className="font-medium">{cat}</span></p>
                  </div>
                  <div className="text-sm">
                    <p>
                      <span className="text-gray-700">Prix de vente :</span>{' '}
                      <span className="font-medium">
                        {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(prix)}
                      </span>
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </main>
      </>
    )
  }