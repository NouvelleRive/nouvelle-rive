// src/app/admin/site/journal/page.tsx — back-office Journal
'use client'

import { useEffect, useMemo, useState } from 'react'
import type { StoredArticle } from '@/lib/journal-articles'
import { parseBody } from '@/lib/journal-articles'

const BLEU = '#22209C'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
function statusOf(a: StoredArticle): { label: string; color: string; bg: string } {
  const live = a.relu && a.published && a.date <= todayISO()
  if (live) return { label: 'En ligne', color: '#fff', bg: BLEU }
  if (a.relu && a.published) return { label: `Programmé ${formatDate(a.date)}`, color: '#92400e', bg: '#fef3c7' }
  if (a.relu) return { label: 'Relu', color: '#3730a3', bg: '#e0e7ff' }
  return { label: 'Brouillon', color: '#6b7280', bg: '#e5e7eb' }
}

export default function AdminJournalPage() {
  const [articles, setArticles] = useState<StoredArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/journal', { cache: 'no-store' })
      const d = await r.json()
      if (Array.isArray(d.articles)) setArticles(d.articles)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const current = articles.find(a => a.slug === selected) || null

  if (current) {
    return (
      <ArticleEditor
        article={current}
        onBack={() => setSelected(null)}
        onSaved={(updated, warning) => {
          setArticles(list => list.map(a => (a.slug === updated.slug ? updated : a)))
          if (warning) alert(warning)
        }}
      />
    )
  }

  const published = articles.filter(a => a.relu && a.published && a.date <= todayISO()).length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: BLEU }}>Journal</h1>
        <p className="text-sm text-gray-500">
          {articles.length} article{articles.length > 1 ? 's' : ''} · {published} en ligne · clique une ligne pour éditer.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Chargement…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Statut</th>
                <th className="py-2 pr-4 font-medium">Titre</th>
                <th className="py-2 pr-4 font-medium">Catégorie</th>
                <th className="py-2 pr-4 font-medium">Mots</th>
              </tr>
            </thead>
            <tbody>
              {articles.map(a => {
                const s = statusOf(a)
                const words = a.body.trim().split(/\s+/).filter(Boolean).length
                return (
                  <tr
                    key={a.slug}
                    onClick={() => setSelected(a.slug)}
                    className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                  >
                    <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">{formatDate(a.date)}</td>
                    <td className="py-3 pr-4">
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap" style={{ color: s.color, background: s.bg }}>
                        {s.label}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-medium text-gray-900">{a.title}</td>
                    <td className="py-3 pr-4 text-gray-500">{a.category}</td>
                    <td className="py-3 pr-4 text-gray-500">{words}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function ArticleEditor({
  article,
  onBack,
  onSaved,
}: {
  article: StoredArticle
  onBack: () => void
  onSaved: (a: StoredArticle, warning?: string) => void
}) {
  const [draft, setDraft] = useState<StoredArticle>(article)
  const [keyword, setKeyword] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const set = <K extends keyof StoredArticle>(k: K, v: StoredArticle[K]) => {
    setDraft(d => ({ ...d, [k]: v }))
    setDirty(true)
  }

  const put = async (patch: Record<string, unknown>): Promise<{ article?: StoredArticle; warning?: string }> => {
    const r = await fetch('/api/journal', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: draft.slug, patch }),
    })
    return r.json()
  }

  const saveContent = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await put({
        title: draft.title,
        description: draft.description,
        category: draft.category,
        date: draft.date,
        readingMinutes: draft.readingMinutes,
        cover: draft.cover ?? '',
        body: draft.body,
        cta: draft.cta ?? null,
      })
      if (res.article) { setDraft(res.article); onSaved(res.article); setDirty(false); setMsg('Enregistré ✓') }
      else setMsg('Erreur à l\'enregistrement')
    } finally { setSaving(false) }
  }

  const toggleRelu = async () => {
    const res = await put({ relu: !draft.relu })
    if (res.article) { setDraft(res.article); onSaved(res.article) }
  }
  const togglePublish = async () => {
    const res = await put({ published: !draft.published })
    if (res.article) { setDraft(res.article); onSaved(res.article, res.warning) }
  }

  // ── Métriques SEO ──
  const seo = useMemo(() => {
    const bodyText = draft.body || ''
    const words = bodyText.trim().split(/\s+/).filter(Boolean).length
    const blocks = parseBody(bodyText)
    const h2 = blocks.filter(b => b.type === 'h2').length
    const firstPara = blocks.find(b => b.type === 'p')?.text || ''
    const kw = keyword.trim().toLowerCase()
    const haystack = (draft.title + ' ' + bodyText).toLowerCase()
    const kwCount = kw ? (haystack.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length : 0
    const density = kw && words ? ((kwCount / words) * 100) : 0
    const checks = [
      { ok: draft.title.length >= 40 && draft.title.length <= 65, label: `Titre ${draft.title.length} car. (idéal 40–65)` },
      { ok: draft.description.length >= 110 && draft.description.length <= 160, label: `Méta description ${draft.description.length} car. (idéal 110–160)` },
      { ok: words >= 300, label: `${words} mots (min. 300 conseillé)` },
      { ok: h2 >= 2, label: `${h2} sous-titre(s) H2 (min. 2)` },
      { ok: !!draft.cover, label: draft.cover ? 'Image de couverture ✓' : 'Ajouter une image de couverture' },
      { ok: !kw || draft.title.toLowerCase().includes(kw), label: 'Mot-clé dans le titre' },
      { ok: !kw || draft.description.toLowerCase().includes(kw), label: 'Mot-clé dans la description' },
      { ok: !kw || firstPara.toLowerCase().includes(kw), label: 'Mot-clé dans le 1er paragraphe' },
    ]
    return { words, h2, kwCount, density, checks }
  }, [draft, keyword])

  const input = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1'
  const label = 'block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={onBack} className="text-sm font-medium hover:underline" style={{ color: BLEU }}>
          ← Tous les articles
        </button>
        <div className="flex items-center gap-2">
          {msg && <span className="text-xs text-gray-500">{msg}</span>}
          <a href={`/journal/${draft.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm px-3 py-1.5 rounded border border-gray-300 hover:border-gray-400">
            Aperçu ↗
          </a>
          <button
            onClick={saveContent}
            disabled={saving || !dirty}
            className="text-sm px-4 py-1.5 rounded text-white disabled:opacity-40"
            style={{ background: BLEU }}
          >
            {saving ? 'Enregistrement…' : dirty ? 'Enregistrer' : 'À jour'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* ── Colonne édition ── */}
        <div className="space-y-4">
          <div>
            <label className={label}>Titre</label>
            <input className={input} value={draft.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div>
            <label className={label}>Méta description (Google)</label>
            <textarea className={input} rows={2} value={draft.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Catégorie</label>
              <input className={input} value={draft.category} onChange={e => set('category', e.target.value)} />
            </div>
            <div>
              <label className={label}>Date de publication</label>
              <input type="date" className={input} value={draft.date} onChange={e => set('date', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Temps de lecture (min)</label>
              <input type="number" min={1} className={input} value={draft.readingMinutes} onChange={e => set('readingMinutes', Number(e.target.value))} />
            </div>
            <div>
              <label className={label}>Image de couverture (URL)</label>
              <input className={input} value={draft.cover ?? ''} placeholder="https://… ou /photo.jpg" onChange={e => set('cover', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={label}>
              Corps de l&apos;article
              <span className="ml-2 font-normal normal-case text-gray-400">## sous-titre · &gt; citation · - puce · ligne vide = paragraphe</span>
            </label>
            <textarea
              className={input + ' font-mono'}
              style={{ minHeight: 420, lineHeight: 1.6 }}
              value={draft.body}
              onChange={e => set('body', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Bouton — texte</label>
              <input className={input} value={draft.cta?.label ?? ''} placeholder="Vendre chez Nouvelle Rive →"
                onChange={e => set('cta', { href: draft.cta?.href ?? '', label: e.target.value })} />
            </div>
            <div>
              <label className={label}>Bouton — lien</label>
              <input className={input} value={draft.cta?.href ?? ''} placeholder="/client/login"
                onChange={e => set('cta', { href: e.target.value, label: draft.cta?.label ?? '' })} />
            </div>
          </div>
        </div>

        {/* ── Panneau SEO / publication (droite) ── */}
        <aside className="space-y-4 lg:sticky lg:top-4 self-start">
          {/* Publication */}
          <div className="rounded-lg border border-gray-200 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Publication</p>
            <button
              onClick={toggleRelu}
              className="w-full text-sm py-2 rounded border font-medium"
              style={draft.relu ? { background: '#e0e7ff', borderColor: '#c7d2fe', color: '#3730a3' } : { borderColor: '#d1d5db', color: '#374151' }}
            >
              {draft.relu ? '✓ Relu' : 'Marquer comme relu'}
            </button>
            <button
              onClick={togglePublish}
              disabled={!draft.relu}
              title={!draft.relu ? 'À relire avant publication' : ''}
              className="w-full text-sm py-2 rounded text-white font-medium disabled:opacity-40"
              style={{ background: draft.published ? '#6b7280' : BLEU }}
            >
              {draft.published ? 'Dépublier' : 'Publier'}
            </button>
            {!draft.relu && (
              <p className="text-xs text-gray-400">Un article doit être relu avant d&apos;être publié.</p>
            )}
            {draft.published && draft.date > todayISO() && (
              <p className="text-xs text-amber-700">Programmé : sortira le {formatDate(draft.date)}.</p>
            )}
          </div>

          {/* SEO */}
          <div className="rounded-lg border border-gray-200 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Analyse SEO</p>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-bold" style={{ color: BLEU }}>{seo.words}</span>
              <span className="text-xs text-gray-500">mots</span>
            </div>
            <div>
              <label className={label}>Mot-clé à suivre</label>
              <input className={input} value={keyword} placeholder="ex: dépôt-vente" onChange={e => setKeyword(e.target.value)} />
              {keyword.trim() && (
                <p className="text-xs text-gray-500 mt-1">
                  {seo.kwCount} occurrence{seo.kwCount > 1 ? 's' : ''} · densité {seo.density.toFixed(1)}%
                  {seo.density > 3 && <span className="text-amber-600"> (un peu élevée)</span>}
                </p>
              )}
            </div>
            <ul className="space-y-1.5 pt-1">
              {seo.checks.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-xs" style={{ color: c.ok ? '#166534' : '#9a3412' }}>
                  <span>{c.ok ? '✓' : '•'}</span>
                  <span>{c.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}
