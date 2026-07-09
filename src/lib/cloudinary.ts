// Helpers Cloudinary partagés client + serveur.
// Le serveur les utilise pour émettre les <link rel="preload"> des premières images ;
// le client les utilise pour les <img srcSet>.

export function getCloudinaryUrl(url: string, size: number = 400): string {
  if (!url || !url.includes('cloudinary.com')) return url

  const transformations = [`w_${size}`, `h_${size}`, 'c_fit', 'q_auto:good', 'f_auto'].join(',')

  return url.replace('/upload/', `/upload/${transformations}/`)
}

export function getCloudinarySrcSet(url: string): string | undefined {
  if (!url || !url.includes('cloudinary.com')) return undefined
  return [300, 450, 600]
    .map((w) => `${getCloudinaryUrl(url, w)} ${w}w`)
    .join(', ')
}

export const CLOUDINARY_GRID_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 400px'
