// app/api/cron/check-factures/route.ts
// Cron horaire — détecte les factures chineuses reçues par mail (Gmail)
// et marque factureRecue:true dans paiements/{mois}/statuts/{chineuseId}.
//
// Scanne nom de PJ + sujet + snippet + corps complet (texte/html) pour
// trouver la référence NR{MM}{YY}-{TRIGRAMME} (cas PJ et cas lien Drive).

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebaseAdmin'

const CRON_SECRET = process.env.CRON_SECRET

type GmailPart = {
  filename?: string
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPart[]
  headers?: { name: string; value: string }[]
}

type GmailMessage = {
  id: string
  snippet?: string
  payload?: GmailPart
}

function getAllParts(payload: GmailPart | undefined): GmailPart[] {
  if (!payload) return []
  const parts = payload.parts || []
  return [...parts, ...parts.flatMap(p => getAllParts(p))]
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })
  }

  // Access token Gmail (refresh token long-lived)
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN || '',
      grant_type: 'refresh_token',
    }),
  })
  const tokenJson = await tokenRes.json() as { access_token?: string; error?: string }
  const access_token = tokenJson.access_token
  if (!access_token) {
    return NextResponse.json({ success: false, error: 'gmail_token_failed', details: tokenJson }, { status: 500 })
  }

  const now = new Date()
  const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMois = `${String(prevDate.getMonth() + 1).padStart(2, '0')}-${prevDate.getFullYear()}`

  const chineusesSnap = await adminDb.collection('chineuse').get()
  const chineuses = chineusesSnap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) }))

  const matched: string[] = []
  const errors: string[] = []

  for (const ch of chineuses as Array<{ id: string; email?: string; emails?: string[]; trigramme?: string }>) {
    if (!ch.email || !ch.trigramme) continue
    const trigramme = ch.trigramme.toUpperCase()

    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const searchY = lastMonth.getFullYear()
    const searchM = String(lastMonth.getMonth() + 1).padStart(2, '0')
    const allEmails = [ch.email, ...(ch.emails || [])].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)
    const fromClause = allEmails.map(e => `from:${e}`).join(' OR ')
    const query = encodeURIComponent(`(${fromClause}) (has:attachment OR has:drive) after:${searchY}/${searchM}/01`)

    const gmailRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=20`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    )
    const gmailData = await gmailRes.json() as { messages?: { id: string }[]; error?: unknown }
    if (gmailData.error) { errors.push(`gmail_error:${ch.email}`); continue }
    if (!gmailData.messages) continue

    for (const msg of gmailData.messages) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${access_token}` } }
      )
      const msgData = await msgRes.json() as GmailMessage

      // Candidats où la ref peut apparaître : nom de PJ, sujet, snippet, corps complet
      const candidates: { source: string; text: string }[] = []
      const allParts = [msgData.payload, ...getAllParts(msgData.payload)].filter(Boolean) as GmailPart[]
      for (const part of allParts) {
        if (part.filename) candidates.push({ source: 'PJ', text: part.filename })
        const mime = part.mimeType || ''
        const data = part.body?.data
        if (data && (mime.startsWith('text/') || mime === '')) {
          try {
            const decoded = Buffer.from(data, 'base64').toString('utf8')
            if (decoded) candidates.push({ source: mime || 'body', text: decoded })
          } catch { /* ignore */ }
        }
      }
      const subject = (msgData.payload?.headers || []).find(h => (h.name || '').toLowerCase() === 'subject')?.value || ''
      if (subject) candidates.push({ source: 'sujet', text: subject })
      if (msgData.snippet) candidates.push({ source: 'snippet', text: msgData.snippet })

      // Accepte plusieurs mois dans un seul mail (cas Sergio : mars + avril en PJ groupées)
      const processedMois = new Set<string>()
      const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const moisFr: Record<string, string> = {
        JANVIER: '01', FEVRIER: '02', FÉVRIER: '02', MARS: '03', AVRIL: '04',
        MAI: '05', JUIN: '06', JUILLET: '07', AOUT: '08', AOÛT: '08',
        SEPTEMBRE: '09', OCTOBRE: '10', NOVEMBRE: '11', DECEMBRE: '12', DÉCEMBRE: '12',
      }
      const moisFrAlt = Object.keys(moisFr).join('|')

      async function markRef(refM: string, refYY: string, refTrig: string, src: string) {
        const refY = '20' + refYY
        const refMois = `${refM}-${refY}`
        const ref = `NR${refM}${refYY}-${refTrig}`
        const refDate = new Date(parseInt(refY), parseInt(refM) - 1, 1)
        if (refDate > curMonthStart) return
        if (refTrig !== trigramme) return
        if (processedMois.has(refMois)) return
        processedMois.add(refMois)
        const statutRef = adminDb.collection('paiements').doc(refMois).collection('statuts').doc(ch.id)
        const existing = await statutRef.get()
        if (!existing.exists || !existing.data()?.factureRecue) {
          await statutRef.set({ factureRecue: true }, { merge: true })
          matched.push(`${ref}:${ch.email}:${src}`)
        }
      }

      for (const cand of candidates) {
        const text = cand.text.toUpperCase()
        // Format strict : NRMMYY-TRIGRAMME
        for (const refMatch of text.matchAll(/NR(\d{2})(\d{2})-([A-Z]+)/g)) {
          await markRef(refMatch[1], refMatch[2], refMatch[3], cand.source)
        }
        // Format libre dans le nom de PJ ou sujet : "facture <mois_fr> <année>"
        // (mail venant déjà de la chineuse via filtre Gmail from:, donc trigramme = celui de la chineuse)
        if (cand.source.startsWith('PJ') || cand.source === 'sujet') {
          const re = new RegExp(`FACTURE\\s+(${moisFrAlt})\\s+(\\d{4})`, 'g')
          for (const m of text.matchAll(re)) {
            const refM = moisFr[m[1]]
            const refYY = m[2].slice(-2)
            if (refM) await markRef(refM, refYY, trigramme, cand.source)
          }
        }
      }
    }
  }

  return NextResponse.json({ success: true, mois: prevMois, matched, errors })
}
