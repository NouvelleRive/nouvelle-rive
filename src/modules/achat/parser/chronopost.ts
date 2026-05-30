// Parser des mails Chronopost "Votre colis est en chemin".
//
// Ce mail est envoyé par le transporteur quand la pièce achetée sur Vinted (ou
// ailleurs) est en cours d'acheminement vers le point relais. On extrait juste
// le numéro de suivi — il servira ensuite à matcher le mail "Colis disponible"
// (Mondial Relay / Pickup / etc.) avec le bon achat.
//
// Si Chronopost envoie plus tard un mail "disponible", on étendra ce module ;
// pour l'instant on couvre uniquement l'étape "expedie".

export type ChronopostEnChemin = {
  ok: true
  provenance: 'chronopost'
  /** Numéro de suivi Chronopost (ex: "XW447030880TS") */
  numeroSuivi: string
}

export type ChronopostResult = ChronopostEnChemin | { ok: false; reason: string }

/**
 * Parse un mail Chronopost "Votre colis EST EN CHEMIN N°XXXXX". Accepte HTML
 * ou texte plat. On accepte 8-20 caractères alphanum pour rester tolérant aux
 * formats de tracking (Chronopost = lettres+chiffres, ~12 chars).
 */
export function parseChronopostEnChemin(rawBody: string): ChronopostResult {
  const text = htmlToText(rawBody)

  // Le sujet est typiquement "Votre colis est en chemin XW447030880TS". On
  // cherche d'abord le motif "Votre colis (TRACK) est en chemin" puis fallback
  // sur "colis (TRACK) est en chemin".
  let numeroSuivi = extractText(
    text,
    /Votre colis\s+([A-Z0-9]{8,20})\s+est en chemin/i
  )
  if (!numeroSuivi) {
    numeroSuivi = extractText(text, /colis\s+([A-Z0-9]{8,20})\s+est en chemin/i)
  }

  if (!numeroSuivi) return { ok: false, reason: 'Numéro de suivi introuvable' }

  return {
    ok: true,
    provenance: 'chronopost',
    numeroSuivi,
  }
}

// ---------------------------------------------------------------------------

function htmlToText(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(tr|td|th|p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&euro;/g, '€')
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n')
}

function extractText(text: string, re: RegExp): string | null {
  const m = text.match(re)
  return m ? m[1].trim() : null
}
