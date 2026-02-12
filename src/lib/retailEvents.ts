// src/lib/retailEvents.ts

export type RetailEvent = { dayStart: number; dayEnd: number; label: string; color: string }

export function getMonthEvents(month: number, year: number): RetailEvent[] {
  const events: RetailEvent[] = []
  const m = month
  const y = year
  const daysInMonth = new Date(y, m + 1, 0).getDate()

  const add = (ds: number, de: number, label: string, color: string) => {
    const s = Math.max(1, ds)
    const e = Math.min(daysInMonth, de)
    if (s <= e) events.push({ dayStart: s, dayEnd: e, label, color })
  }

  const addRange = (sy: number, ms: number, ds: number, me: number, de: number, label: string, color: string) => {
    if (sy !== y) return
    if (m === ms && m === me) add(ds, de, label, color)
    else if (m === ms && m < me) add(ds, daysInMonth, label, color)
    else if (m > ms && m < me) add(1, daysInMonth, label, color)
    else if (m === me && m > ms) add(1, de, label, color)
  }

  // === PFW ===
  const pfw: [number,number,number,number,number,string][] = [
    [2024,0,16,0,21,'PFW Men'],[2024,0,22,0,25,'PFW HC'],[2024,1,26,2,5,'PFW Women'],[2024,5,18,5,23,'PFW Men'],[2024,5,24,5,27,'PFW HC'],[2024,8,23,9,1,'PFW Women'],
    [2025,0,21,0,26,'PFW Men'],[2025,0,27,0,30,'PFW HC'],[2025,2,3,2,11,'PFW Women'],[2025,5,24,5,29,'PFW Men'],[2025,6,7,6,10,'PFW HC'],[2025,8,29,9,7,'PFW Women'],
    [2026,0,20,0,25,'PFW Men'],[2026,0,26,0,29,'PFW HC'],[2026,2,2,2,10,'PFW Women'],[2026,5,23,5,28,'PFW Men'],[2026,6,6,6,9,'PFW HC'],[2026,8,28,9,6,'PFW Women'],
  ]
  pfw.forEach(([py,ms,ds,me,de,label]) => addRange(py,ms,ds,me,de,label,'rgba(99,102,241,0.15)'))

  // === Soldes Paris ===
  const soldes: [number,number,number,number,number][] = [
    [2024,0,10,1,6],[2024,5,26,6,23],
    [2025,0,8,1,4],[2025,5,25,6,22],
    [2026,0,7,1,3],[2026,5,24,6,21],
  ]
  soldes.forEach(([sy,ms,ds,me,de]) => addRange(sy,ms,ds,me,de,'Soldes','rgba(220,38,38,0.15)'))

  // === Vacances Zone C Paris ===
  const vac: [number,number,number,number,number,string][] = [
    [2024,9,19,10,3,'Vac Toussaint'],[2024,11,21,0,6,'Vac Noël'],
    [2025,1,22,2,10,'Vac Hiver'],[2025,3,19,4,5,'Vac Printemps'],[2025,9,18,10,3,'Vac Toussaint'],[2025,11,20,0,5,'Vac Noël'],
    [2026,1,21,2,9,'Vac Hiver'],[2026,3,18,4,4,'Vac Printemps'],[2026,9,17,10,2,'Vac Toussaint'],[2026,11,19,0,4,'Vac Noël'],
  ]
  vac.forEach(([vy,ms,ds,me,de,label]) => {
    if (vy === y) { if (m >= ms) addRange(y,ms,ds,me,de,label,'rgba(107,114,128,0.15)') }
    if (vy === y - 1 && me === 0) { if (m === 0) add(1, de, label, 'rgba(107,114,128,0.15)') }
  })

  // === US Spring Break (approx mi-mars - mi-avril) ===
  if (m === 2) add(15, daysInMonth, 'US Spring Break', 'rgba(245,158,11,0.15)')
  if (m === 3) add(1, 15, 'US Spring Break', 'rgba(245,158,11,0.15)')

  // === US Summer (juin - aout) ===
  if (m === 5) add(10, daysInMonth, 'US Summer', 'rgba(245,158,11,0.15)')
  if (m === 6) add(1, daysInMonth, 'US Summer', 'rgba(245,158,11,0.15)')
  if (m === 7) add(1, 25, 'US Summer', 'rgba(245,158,11,0.15)')

  // === US Xmas Break ===
  if (m === 11) add(20, daysInMonth, 'US Xmas', 'rgba(245,158,11,0.15)')
  if (m === 0) add(1, 3, 'US Xmas', 'rgba(245,158,11,0.15)')

  // === US feries (1 jour) ===
  const memorialDay: Record<number,number> = {2024:27,2025:26,2026:25}
  if (m===4 && memorialDay[y]) add(memorialDay[y],memorialDay[y],'US Memorial Day','rgba(245,158,11,0.20)')
  const laborDay: Record<number,number> = {2024:2,2025:1,2026:7}
  if (m===8 && laborDay[y]) add(laborDay[y],laborDay[y],'US Labor Day','rgba(245,158,11,0.20)')
  if (m===6) add(4,4,'US 4th July','rgba(245,158,11,0.20)')
  const thanksgiving: Record<number,number> = {2024:28,2025:27,2026:26}
  if (m===10 && thanksgiving[y]) add(thanksgiving[y],thanksgiving[y],'US Thanksgiving','rgba(245,158,11,0.20)')

  // === Black Friday - Cyber Monday ===
  if (m===10 && thanksgiving[y]) add(thanksgiving[y]+1,thanksgiving[y]+4,'BF - CM','rgba(17,17,17,0.18)')

  // === Golden Week Chine ===
  if (m===9) add(1,7,'CN Golden Week','rgba(239,68,68,0.15)')

  // === Jours feries FR (1 jour) ===
  if (m===0) add(1,1,'Nouvel An','rgba(37,99,235,0.20)')
  if (m===4) { add(1,1,'1er Mai','rgba(37,99,235,0.20)'); add(8,8,'8 Mai','rgba(37,99,235,0.20)') }
  if (m===6) add(14,14,'14 Juil.','rgba(37,99,235,0.20)')
  if (m===7) add(15,15,'15 Aout','rgba(37,99,235,0.20)')
  if (m===10) { add(1,1,'Toussaint','rgba(37,99,235,0.20)'); add(11,11,'11 Nov','rgba(37,99,235,0.20)') }
  const paques: Record<number,[number,number]> = {2024:[2,31],2025:[3,20],2026:[3,5]}
  if (paques[y] && m===paques[y][0]) add(paques[y][1],paques[y][1],'Paques','rgba(37,99,235,0.20)')
  const ascension: Record<number,[number,number]> = {2024:[4,9],2025:[4,29],2026:[4,14]}
  if (ascension[y] && m===ascension[y][0]) add(ascension[y][1],ascension[y][1],'Ascension','rgba(37,99,235,0.20)')

  // === Fetes commerciales (1 jour) ===
  if (m===1) add(14,14,'St Valentin','rgba(225,29,72,0.20)')
  if (m===11) add(25,25,'Noel','rgba(22,163,74,0.20)')
  const feteMeres: Record<number,[number,number]> = {2024:[4,26],2025:[4,25],2026:[4,31]}
  if (feteMeres[y] && m===feteMeres[y][0]) add(feteMeres[y][1],feteMeres[y][1],'Fete meres','rgba(217,70,239,0.20)')

  return events
}