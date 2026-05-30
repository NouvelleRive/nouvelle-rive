// Parser des mails Chronopost Pickup "Votre colis VINTED est arrivé en relais".
//
// Variante "disponible" côté Chronopost (équivalent du "disponible" Mondial Relay,
// mais sur le réseau Pickup). On extrait n° colis, code retrait, point relais
// et date limite de retrait.

export type ChronopostPickupDispo = {
  ok: true
  provenance: 'chronopost-pickup'
  /** Numéro de suivi Chronopost (ex: "XW447647819TS") — clé de matching */
  numeroSuivi: string
  /** Code de retrait à présenter au commerçant si pas de Pickup Pass */
  codeRetrait: string
  /** Date limite de retrait, gardée telle quelle ("4 juin 2026") */
  dateLimiteRetrait: string
  /** Nom du relais Pickup (ex: "HAK MINI MARKET") */
  nomRelais: string
  /** Adresse du relais (rue + CP + ville) */
  adresseRelais: string
  /** Chaîne prête à afficher : "{nom} · {adresse}" */
  lieuLivraison: string
}

export type ChronopostPickupResult = ChronopostPickupDispo | { ok: false; reason: string }

/**
 * Parse un mail Chronopost Pickup "Votre colis est arrivé en relais Pickup".
 * Accepte HTML ou texte plat.
 */
export function parseChronopostPickupDispo(rawBody: string): ChronopostPickupResult {
  const text = htmlToText(rawBody)

  // Numéro de suivi : libellé "Numéro de colis XXXXXX" (multi-ligne possible).
  const numeroSuivi = extractText(
    text,
    /Num[ée]ro de colis\s*\n?\s*([A-Z0-9]{8,20})/i
  )

  // Code de retrait : libellé "code de retrait suivant au commerçant : NNN".
  const codeRetrait = extractText(
    text,
    /code de retrait\s+suivant\s+au\s+commer[çc]ant\s*:?\s*(\d{4,8})/i
  )

  // Date limite : "À retirer jusqu'au\n…\n4 juin 2026" OU "avant le 4 juin 2026"
  let dateLimiteRetrait = extractText(
    text,
    /À\s+retirer\s+jusqu['’]au\s+(?:\n\s*)?(?:[a-z]+\s+)?(\d{1,2}\s+\w+\s+\d{4})/i
  )
  if (!dateLimiteRetrait) {
    dateLimiteRetrait = extractText(text, /avant\s+le\s+(\d{1,2}\s+\w+\s+\d{4})/i)
  }

  // Bloc relais : libellé "Détails du relais Pickup" puis nom + adresse.
  // Si non trouvé, fallback sur "au relais NOM." dans le corps.
  let nomRelais: string | null = null
  let adresseRelais: string | null = null

  const blocDetails = extractText(
    text,
    /D[ée]tails\s+du\s+relais\s+Pickup\s*\n+([\s\S]+?)(?=\n\s*(?:Horaires|Voir|Pour r[eé]cup|Chronopost\s+s['’]engage|$))/i
  )
  if (blocDetails) {
    const parsed = parseBlocRelais(blocDetails)
    nomRelais = parsed.nomRelais
    adresseRelais = parsed.adresseRelais
  }

  // Fallback : "au relais NOM."
  if (!nomRelais) {
    nomRelais = extractText(text, /au\s+relais\s+([A-Z][A-Z0-9 &'.-]{2,})\./)
  }

  if (!numeroSuivi) return { ok: false, reason: 'Numéro de suivi introuvable' }
  if (!nomRelais) return { ok: false, reason: 'Nom du relais introuvable' }

  return {
    ok: true,
    provenance: 'chronopost-pickup',
    numeroSuivi,
    codeRetrait: codeRetrait ?? '',
    dateLimiteRetrait: dateLimiteRetrait ?? '',
    nomRelais,
    adresseRelais: adresseRelais ?? '',
    lieuLivraison: adresseRelais ? `${nomRelais} · ${adresseRelais}` : nomRelais,
  }
}

function parseBlocRelais(bloc: string): { nomRelais: string; adresseRelais: string } {
  const lignes = bloc
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lignes.length === 0) return { nomRelais: '', adresseRelais: '' }
  const [nomRelais, ...resteLignes] = lignes
  return { nomRelais, adresseRelais: resteLignes.join(', ') }
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
