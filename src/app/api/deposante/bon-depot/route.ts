// app/api/deposante/bon-depot/route.ts
// Génère un bon de dépôt PDF (accusé de réception NR) et l'envoie par email à la déposante.
// Déclenché par la vendeuse depuis la page de réception quand toutes les pièces DEP du trigramme sont marquées "reçues".
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebaseAdmin'
import { Timestamp } from 'firebase-admin/firestore'
import { Resend } from 'resend'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const resend = new Resend(process.env.RESEND_API_KEY)
const STAFF_EMAILS = new Set(['nouvelleriveparis@gmail.com', 'nouvellerivecommandes@gmail.com'])

async function fetchImageData(url: string): Promise<{ base64: string; format: 'JPEG' | 'PNG' } | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') || ''
    const buf = await res.arrayBuffer()
    const base64 = Buffer.from(buf).toString('base64')
    const format: 'JPEG' | 'PNG' = ct.includes('png') ? 'PNG' : 'JPEG'
    return { base64: `data:${ct || 'image/jpeg'};base64,${base64}`, format }
  } catch { return null }
}

function getMainPhoto(p: any): string | null {
  if (p?.photos?.face) return p.photos.face
  if (p?.imageUrl) return p.imageUrl
  if (Array.isArray(p?.imageUrls) && p.imageUrls.length > 0) return p.imageUrls[0]
  return null
}

export async function POST(req: NextRequest) {
  try {
    // Auth : vendeuse / admin
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
    let decoded
    try { decoded = await adminAuth.verifyIdToken(token) } catch {
      return NextResponse.json({ success: false, error: 'Token invalide' }, { status: 401 })
    }
    if (!decoded.email || !STAFF_EMAILS.has(decoded.email)) {
      return NextResponse.json({ success: false, error: 'Réservé au staff' }, { status: 403 })
    }

    const body = await req.json()
    const { trigramme, vendeusePrenom } = body as { trigramme: string; vendeusePrenom?: string }
    if (!trigramme) {
      return NextResponse.json({ success: false, error: 'Trigramme manquant' }, { status: 400 })
    }

    // Récupère la déposante
    const depSnap = await adminDb.collection('deposante').where('trigramme', '==', trigramme).limit(1).get()
    if (depSnap.empty) return NextResponse.json({ success: false, error: 'Déposante introuvable' }, { status: 404 })
    const dep: any = depSnap.docs[0].data()
    if (!dep.email) return NextResponse.json({ success: false, error: 'Email déposante manquant' }, { status: 400 })

    // Récupère les pièces : déposante + reçues récemment (<24h) + pas encore dans un bon envoyé
    const since = Date.now() - 24 * 3600 * 1000
    const snap = await adminDb.collection('produits')
      .where('source', '==', 'deposante')
      .where('trigramme', '==', trigramme)
      .where('recu', '==', true)
      .get()
    const pieces = snap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .filter(p => !p.bonDepotEnvoyeAt && (p.dateReception?.toMillis?.() || 0) >= since)
    if (pieces.length === 0) return NextResponse.json({ success: false, error: 'Aucune pièce reçue récemment' }, { status: 404 })

    // Pré-charge images principales + défauts
    const mainImages: Record<string, { base64: string; format: 'JPEG' | 'PNG' } | null> = {}
    const defautImages: Record<string, Array<{ base64: string; format: 'JPEG' | 'PNG' } | null>> = {}
    await Promise.all(pieces.map(async (p) => {
      const main = getMainPhoto(p)
      mainImages[p.id] = main ? await fetchImageData(main) : null
      const dfs: string[] = Array.isArray(p.photosDefautsReception) ? p.photosDefautsReception : []
      defautImages[p.id] = await Promise.all(dfs.map(u => fetchImageData(u)))
    }))

    // Génération PDF
    const docPDF = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageW = docPDF.internal.pageSize.getWidth()
    const pageH = docPDF.internal.pageSize.getHeight()
    const margin = 40

    const dateStr = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

    docPDF.setFont('helvetica', 'bold')
    docPDF.setFontSize(14)
    docPDF.text('NR1 SAS — NOUVELLE RIVE', margin, 56)
    docPDF.setFont('helvetica', 'normal')
    docPDF.setFontSize(9)
    docPDF.text('5 route du Grand Pont, 78110 Le Vésinet', margin, 70)
    docPDF.text('Boutique : 8 rue des Écouffes, 75004 Paris', margin, 82)

    docPDF.setFont('helvetica', 'bold')
    docPDF.setFontSize(16)
    docPDF.text('BON DE DÉPÔT', pageW / 2, 120, { align: 'center' })
    docPDF.setFont('helvetica', 'normal')
    docPDF.setFontSize(10)
    docPDF.text(`Accusé de réception du ${dateStr}`, pageW / 2, 138, { align: 'center' })

    // Bloc déposante
    let y = 170
    docPDF.setFont('helvetica', 'bold')
    docPDF.text('Déposante', margin, y)
    docPDF.setFont('helvetica', 'normal')
    y += 14
    docPDF.text(`${(dep.prenom || '').toString()} ${(dep.nom || '').toString()}`.trim() || trigramme, margin, y)
    y += 14
    docPDF.text(`Trigramme : ${trigramme}`, margin, y)
    if (dep.email) { y += 14; docPDF.text(`Email : ${dep.email}`, margin, y) }

    // Mention
    y += 26
    docPDF.setFont('helvetica', 'italic')
    docPDF.setFontSize(9)
    const mention = `NR1 SAS (Nouvelle Rive) accuse réception des ${pieces.length} pièce${pieces.length > 1 ? 's' : ''} listée${pieces.length > 1 ? 's' : ''} ci-dessous, en l'état décrit, déposée${pieces.length > 1 ? 's' : ''} par ${(dep.prenom || trigramme).toString()} le ${dateStr}.`
    const mentionLines = docPDF.splitTextToSize(mention, pageW - margin * 2)
    docPDF.text(mentionLines, margin, y)
    y += mentionLines.length * 12 + 8
    docPDF.setFont('helvetica', 'normal')
    docPDF.setFontSize(10)

    // Tableau pièces
    const tableBody = pieces.map(p => [
      p.sku || '',
      (p.nom || '').toString().slice(0, 40),
      p.marque || '',
      p.taille || '',
      typeof p.prix === 'number' ? `${p.prix.toFixed(2)} €` : '',
      p.noteReception || (Array.isArray(p.photosDefautsReception) && p.photosDefautsReception.length > 0 ? `${p.photosDefautsReception.length} photo(s)` : ''),
    ])
    autoTable(docPDF, {
      startY: y,
      head: [['SKU', 'Nom', 'Marque', 'Taille', 'Prix', 'Note / défauts']],
      body: tableBody,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [34, 32, 156] },
      margin: { left: margin, right: margin },
    })
    y = (docPDF as any).lastAutoTable.finalY + 20

    // Section photos (1 page par pièce avec photo + défauts s'il y en a)
    for (const p of pieces) {
      const main = mainImages[p.id]
      const dfs = (defautImages[p.id] || []).filter(Boolean) as Array<{ base64: string; format: 'JPEG' | 'PNG' }>
      if (!main && dfs.length === 0) continue

      docPDF.addPage()
      let py = 60
      docPDF.setFont('helvetica', 'bold')
      docPDF.setFontSize(11)
      docPDF.text(`${p.sku || ''}  ${(p.nom || '').toString()}`, margin, py)
      docPDF.setFont('helvetica', 'normal')
      docPDF.setFontSize(9)
      py += 16
      if (p.marque) { docPDF.text(`Marque : ${p.marque}`, margin, py); py += 12 }
      if (typeof p.prix === 'number') { docPDF.text(`Prix : ${p.prix.toFixed(2)} €`, margin, py); py += 12 }
      if (p.noteReception) { docPDF.text(`Note : ${p.noteReception}`, margin, py); py += 12 }
      py += 8

      if (main) {
        try {
          docPDF.addImage(main.base64, main.format, margin, py, 220, 220)
        } catch (e) { console.error('addImage main:', (e as any)?.message) }
        py += 230
      }
      if (dfs.length > 0) {
        docPDF.setFont('helvetica', 'bold')
        docPDF.text('Photos défauts :', margin, py); py += 14
        docPDF.setFont('helvetica', 'normal')
        let dx = margin
        const size = 110
        for (const img of dfs) {
          if (dx + size > pageW - margin) { dx = margin; py += size + 8 }
          if (py + size > pageH - margin) { docPDF.addPage(); py = 60; dx = margin }
          try { docPDF.addImage(img.base64, img.format, dx, py, size, size) }
          catch (e) { console.error('addImage def:', (e as any)?.message) }
          dx += size + 8
        }
      }
    }

    // Footer signature dernière page
    docPDF.setPage(docPDF.getNumberOfPages())
    const lastY = docPDF.internal.pageSize.getHeight() - 80
    docPDF.setFont('helvetica', 'normal')
    docPDF.setFontSize(9)
    docPDF.text(`Réceptionné par : ${vendeusePrenom || 'Nouvelle Rive'}`, margin, lastY)
    docPDF.text(`Le ${dateStr}`, margin, lastY + 12)

    const pdfBase64 = docPDF.output('datauristring').split(',')[1]

    // Email avec PDF en attachement
    const filename = `bon-depot_${trigramme}_${new Date().toISOString().slice(0, 10)}.pdf`
    try {
      await resend.emails.send({
        from: 'Nouvelle Rive <noreply@nouvellerive.eu>',
        to: dep.email,
        bcc: 'nouvelleriveparis@gmail.com',
        subject: `Bon de dépôt — ${pieces.length} pièce${pieces.length > 1 ? 's' : ''} reçue${pieces.length > 1 ? 's' : ''} 💙`,
        html: `
          <div style="font-family:Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;color:#000;">
            <h1 style="color:#22209C;">Bon de dépôt 💙</h1>
            <p>Bonjour ${dep.prenom || ''},</p>
            <p>Nous avons bien réceptionné <strong>${pieces.length} pièce${pieces.length > 1 ? 's' : ''}</strong> ce ${dateStr}. Vous trouverez en pièce jointe le bon de dépôt récapitulatif.</p>
            <p>Bonne nouvelle : vos articles vont être mis en vente dans les prochains jours.</p>
            <p style="font-size:12px;color:#888;margin-top:32px;">À bientôt 🌊</p>
          </div>
        `,
        attachments: [{ filename, content: pdfBase64 }],
      })
    } catch (e: any) {
      console.error('Email bon-depot KO:', e?.message)
      return NextResponse.json({ success: false, error: 'Envoi email échoué' }, { status: 500 })
    }

    // Marque chaque pièce comme "bon envoyé"
    const batch = adminDb.batch()
    for (const p of pieces) {
      batch.update(adminDb.collection('produits').doc(p.id), { bonDepotEnvoyeAt: Timestamp.now() })
    }
    await batch.commit()

    return NextResponse.json({ success: true, email: dep.email, nbPieces: pieces.length })
  } catch (e: any) {
    console.error('[deposante/bon-depot]', e?.message || e)
    return NextResponse.json({ success: false, error: e?.message || 'Erreur' }, { status: 500 })
  }
}
