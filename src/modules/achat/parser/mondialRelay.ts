// Parsers des mails Mondial Relay liés à un colis.
//
// Deux variantes gérées :
//   1. "Votre colis NNN est disponible"     → mail final, le colis est prêt
//      à retirer en point relais (code retrait + date limite + adresse).
//   2. "Votre colis NNN sera livré dans un autre Point Relais" → notification
//      de redirection : le relais initial est indisponible, on a la nouvelle
//      adresse mais PAS encore de code retrait ni date limite.
//
// Dans les deux cas on récupère le n° de colis, le nom et l'adresse du relais.
// Le mail ne contient jamais la référence Vinted — le matching côté NR se fera
// via le numéro de colis stocké lors de l'expédition.

export type MondialRelayDispo = {
  ok: true
  provenance: 'mondial-relay'
  /** Type d'événement détecté */
  kind: 'disponible' | 'redirige'
  /** Numéro de colis Mondial Relay (clé de matching avec l'achat) */
  numeroColis: string
  /** Code de retrait à présenter en point relais (absent si redirige) */
  codeRetrait: string
  /** Date limite de retrait au format JJ/MM, vide si pas encore connue */
  dateLimiteRetrait: string
  /** Nom du point relais (ex: "MERCERIE") */
  nomRelais: string
  /** Adresse du point relais (rue + CP + ville) */
  adresseRelais: string
  /** Chaîne prête à afficher : "{nom} · {adresse}" */
  lieuLivraison: string
}

export type MondialRelayResult = MondialRelayDispo | { ok: false; reason: string }

/**
 * Parse un mail Mondial Relay. Détecte automatiquement la variante
 * "disponible" vs "relais redirigé" et retourne la structure unifiée.
 */
export function parseMondialRelayDispo(rawBody: string): MondialRelayResult {
  const text = htmlToText(rawBody)

  // Numéro de colis : présent dans le sujet ("colis N° xxxx") et dans le corps
  // ("colis n°xxxx est disponible"). On capture la version la plus longue dispo.
  const numeroColis = extractText(text, /colis\s*(?:n°|N°|num[ée]ro)?\s*(\d{6,})/i)

  // Code de retrait : libellé "CODE DE RETRAIT" puis le code (4-8 chiffres).
  const codeRetrait = extractText(text, /CODE\s*DE\s*RETRAIT\s+(\d{4,8})/i)

  // Date limite : libellé "RETRAIT JUSQU'AU JJ/MM" (Mondial Relay n'écrit pas l'année).
  const dateLimiteRetrait = extractText(text, /RETRAIT\s*JUSQU['’]?AU\s+(\d{1,2}\/\d{1,2})/i)

  // Détecte le mail "relais redirigé" : pas de bloc POINT RELAIS®, juste une
  // nouvelle adresse présentée après "sera finalement livré à cette adresse :".
  const isRedirige = /sera\s+(?:finalement\s+)?livr[ée]\s+(?:dans\s+un\s+autre\s+Point\s+Relais|à\s+cette\s+adresse)/i.test(text)

  let blocRelais: string | null
  if (isRedirige) {
    blocRelais = extractText(
      text,
      /(?:à\s+cette\s+adresse\s*:|nouvelle\s+adresse\s*:)\s*\n+([\s\S]+?)(?=\n\s*(?:Nous sommes navrés|Pour plus d|Suivre mon colis|L['’]équipe|$))/i
    )
  } else {
    // Mail "disponible" classique : "POINT RELAIS®" puis nom + adresse multi-ligne
    blocRelais = extractText(
      text,
      /POINT\s*RELAIS[®\*]?\s+([\s\S]+?)(?=\n\s*(?:SUPER PRATIQUE|UN IMPR|PROFITEZ|S'y rendre|Je consulte|$))/i
    )
  }

  if (!numeroColis) return { ok: false, reason: 'Numéro de colis introuvable' }
  if (!blocRelais) return { ok: false, reason: 'Bloc point relais introuvable' }

  const { nomRelais, adresseRelais } = parseBlocRelais(blocRelais)
  if (!nomRelais || !adresseRelais) {
    return { ok: false, reason: 'Nom ou adresse du point relais introuvable' }
  }

  return {
    ok: true,
    provenance: 'mondial-relay',
    kind: isRedirige ? 'redirige' : 'disponible',
    numeroColis,
    codeRetrait: codeRetrait ?? '',
    dateLimiteRetrait: dateLimiteRetrait ?? '',
    nomRelais,
    adresseRelais,
    lieuLivraison: `${nomRelais} · ${adresseRelais}`,
  }
}

/**
 * Le bloc point relais arrive sous forme de plusieurs lignes : nom du relais,
 * rue, code postal + ville. On garde la 1ère ligne comme nom, le reste comme
 * adresse jointe par des virgules.
 */
function parseBlocRelais(bloc: string): { nomRelais: string; adresseRelais: string } {
  const lignes = bloc
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lignes.length === 0) return { nomRelais: '', adresseRelais: '' }
  const [nomRelais, ...resteLignes] = lignes
  return {
    nomRelais,
    adresseRelais: resteLignes.join(', '),
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
