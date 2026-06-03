// Util global de formatage prix — séparateur de milliers FR (espace fine)
// 1500   -> "1 500"
// 1500.5 -> "1 500,50"  (avec decimals)
// 1500   -> "1 500"     (sans decimals)

export function formatPrix(n: number | null | undefined, opts?: { decimals?: 0 | 2 }): string {
  const v = Number(n) || 0
  const decimals = opts?.decimals ?? 0
  return v
    .toLocaleString('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    .replace(/[  ]/g, ' ')
}

// Version avec symbole € collé : "1 500 €"
export function formatPrixEuro(n: number | null | undefined, opts?: { decimals?: 0 | 2 }): string {
  return `${formatPrix(n, opts)} €`
}
