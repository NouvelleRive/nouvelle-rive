// lib/rehydrateTimestamps.ts
// Reconvertit les Timestamps sérialisés par firebase-admin en Timestamps du SDK
// client. NextResponse.json() sérialise les Timestamps admin en
// { _seconds, _nanoseconds }, ce qui casse `instanceof Timestamp` et `.toDate()`
// côté client. On parcourt récursivement et on rehydrate.

import { Timestamp } from 'firebase/firestore'

function isSerializedTimestamp(o: any): boolean {
  if (!o || typeof o !== 'object') return false
  const s = o._seconds ?? o.seconds
  const n = o._nanoseconds ?? o.nanoseconds
  if (typeof s !== 'number' || typeof n !== 'number') return false
  // Timestamp Firestore = uniquement 2 clés. Pas 3+, sinon c'est un autre objet.
  const keys = Object.keys(o)
  return keys.length === 2
}

export function rehydrateTimestamps<T = any>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(rehydrateTimestamps) as any
  if (isSerializedTimestamp(value)) {
    const o = value as any
    return new Timestamp(o._seconds ?? o.seconds, o._nanoseconds ?? o.nanoseconds) as any
  }
  const out: any = {}
  for (const k in value) out[k] = rehydrateTimestamps((value as any)[k])
  return out
}
