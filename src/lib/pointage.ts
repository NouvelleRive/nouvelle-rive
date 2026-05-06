// Configuration du pointage vendeuses
// 8 rue des Écouffes, 75004 Paris
export const BOUTIQUE_LAT = 48.8559
export const BOUTIQUE_LNG = 2.3576
export const GEOFENCE_RADIUS_M = 150 // tolérance GPS (mètres)

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function isAtBoutique(lat: number, lng: number): boolean {
  return distanceMeters(lat, lng, BOUTIQUE_LAT, BOUTIQUE_LNG) <= GEOFENCE_RADIUS_M
}

export function pointageDocId(date: Date, vendeuseId: string): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}_${vendeuseId}`
}
