// src/app/admin/site/journal/page.tsx — back-office Journal (aperçu)
// V1 : vue d'ensemble des articles (source = src/lib/journal-articles.ts).
// Le back complet (édition depuis l'UI) s'installera ici.
import { ARTICLES } from '@/lib/journal-articles'

const BLEU = '#22209C'

function formatDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function AdminJournalPage() {
  const sorted = [...ARTICLES].sort((a, b) => b.date.localeCompare(a.date))
  const publishedCount = ARTICLES.filter(a => a.published).length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: BLEU }}>Journal</h1>
        <p className="text-sm text-gray-500">
          {ARTICLES.length} article{ARTICLES.length > 1 ? 's' : ''} · {publishedCount} publié{publishedCount > 1 ? 's' : ''} · {ARTICLES.length - publishedCount} brouillon{ARTICLES.length - publishedCount > 1 ? 's' : ''}
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-amber-50 px-4 py-3 text-sm text-gray-700">
        Édition actuelle via le fichier <code className="rounded bg-white px-1 py-0.5 border">src/lib/journal-articles.ts</code> :
        passe <code className="rounded bg-white px-1 py-0.5 border">published: true</code> pour mettre un article en ligne.
        Le back-office d'édition complet s'installera sur cette page.
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-2 pr-4 font-medium">Statut</th>
              <th className="py-2 pr-4 font-medium">Titre</th>
              <th className="py-2 pr-4 font-medium">Catégorie</th>
              <th className="py-2 pr-4 font-medium">Date</th>
              <th className="py-2 pr-4 font-medium">Lecture</th>
              <th className="py-2 pr-4 font-medium">Aperçu</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(a => (
              <tr key={a.slug} className="border-b border-gray-100 align-top">
                <td className="py-3 pr-4">
                  {a.published ? (
                    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ background: BLEU }}>
                      En ligne
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">
                      Brouillon
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 font-medium text-gray-900">{a.title}</td>
                <td className="py-3 pr-4 text-gray-500">{a.category}</td>
                <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">{formatDate(a.date)}</td>
                <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">{a.readingMinutes} min</td>
                <td className="py-3 pr-4">
                  <a
                    href={`/journal/${a.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline"
                    style={{ color: BLEU }}
                  >
                    Voir →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
