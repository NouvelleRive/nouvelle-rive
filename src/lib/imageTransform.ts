/**
 * Cadrage d'une photo dans son cadre carré : zoom + point de focus.
 * Stocké en base sur les iconiques, aligné index par index sur `images`.
 */
export type ImageTransform = {
  /** 1 = image telle quelle (object-cover), 3 = zoom x3 max. */
  scale: number
  /** Point de focus horizontal en %, 0 = à gauche, 100 = à droite. */
  x: number
  /** Point de focus vertical en %, 0 = en haut, 100 = en bas. */
  y: number
}

export const DEFAULT_IMAGE_TRANSFORM: ImageTransform = { scale: 1, x: 50, y: 50 }

/** Récupère le cadrage d'une photo, en retombant sur le cadrage neutre. */
export function getImageTransform(
  transforms: ImageTransform[] | undefined,
  index: number
): ImageTransform {
  const t = transforms?.[index]
  if (!t) return DEFAULT_IMAGE_TRANSFORM
  return {
    scale: Number(t.scale) > 0 ? Number(t.scale) : 1,
    x: Number.isFinite(t.x) ? t.x : 50,
    y: Number.isFinite(t.y) ? t.y : 50,
  }
}

/**
 * Style à poser sur un `<img class="object-cover">` : le point de focus passe par
 * objectPosition (pas de débordement possible), le zoom par un scale depuis ce même point.
 */
export function imageTransformStyle(t: ImageTransform): React.CSSProperties {
  return {
    objectPosition: `${t.x}% ${t.y}%`,
    transform: t.scale === 1 ? undefined : `scale(${t.scale})`,
    transformOrigin: `${t.x}% ${t.y}%`,
  }
}
