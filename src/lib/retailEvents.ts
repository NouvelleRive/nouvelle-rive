// src/lib/retailEvents.ts

type RetailEvent = { day: number; label: string; color: string }

export function getMonthEvents(month: number, year: number): RetailEvent[] {
  const events: RetailEvent[] = []
  const m = month
  const y = year

  // === PFW ===
  const pfw: [number,number,number,number,number,string][] = [
    [2024,0,16,0,21,'PFW Men'],[2024,0,22,0,25,'PFW HC'],[2024,1,26,2,5,'PFW Women'],[2024,5,18,5,23,'PFW Men'],[2024,5,24,5,27,'PFW HC'],[2024,8,23,9,1,'PFW Women'],
    [2025,0,21,0,26,'PFW Men'],[2025,0,27,0,30,'PFW HC'],[2025,2,3,2,11,'PFW Women'],[2025,5,24,5,29,'PFW Men'],[2025,6,7,6,10,'PFW HC'],[2025,8,29,9,7,'PFW Women'],
    [2026,0,20,0,25,'PFW Men'],[2026,0,26,0,29,'PFW HC'],[2026,2,2,2,10,'PFW Women'],[2026,5,23,5,28,'PFW Men'],[2026,6,6,6,9,'PFW HC'],[2026,8,28,9,6,'PFW Women'],
  ]
  pfw.forEach(([py,ms,ds,me,de,label]) => {
    if (py===y && m===ms) events.push({day:ds,label,color:'#000'})
    if (py===y && m===me && me!==ms) events.push({day:de,label:label+' fin',color:'#000'})
  })

  // === Soldes Paris ===
  const soldes: [number,number,number,number,number][] = [
    [2024,0,10,1,6],[2024,5,26,6,23],
    [2025,0,8,1,4],[2025,5,25,6,22],
    [2026,0,7,1,3],[2026,5,24,6,21],
  ]
  soldes.forEach(([sy,ms,ds,me,de]) => {
    if (sy===y && m===ms) events.push({day:ds,label:'Soldes',color:'#DC2626'})
    if (sy===y && m===me) events.push({day:de,label:'Fin soldes',color:'#DC2626'})
  })

  // === Vacances Zone C Paris ===
  const vacFR: [number,number,number,string][] = [
    [2024,9,19,'Vac Toussaint'],[2024,11,21,'Vac Noël'],
    [2025,0,6,'Fin vac Noël'],[2025,1,22,'Vac Hiver'],[2025,2,10,'Fin vac Hiver'],[2025,3,19,'Vac Print.'],[2025,4,5,'Fin vac Print.'],[2025,9,18,'Vac Toussaint'],[2025,10,3,'Fin vac Toussaint'],[2025,11,20,'Vac Noël'],
    [2026,0,5,'Fin vac Noël'],[2026,1,21,'Vac Hiver'],[2026,2,9,'Fin vac Hiver'],[2026,3,18,'Vac Print.'],[2026,4,4,'Fin vac Print.'],[2026,9,17,'Vac Toussaint'],[2026,10,2,'Fin vac Toussaint'],[2026,11,19,'Vac Noël'],
  ]
  vacFR.forEach(([vy,vm,vd,vl]) => { if (vy===y && vm===m) events.push({day:vd,label:vl,color:'#6B7280'}) })

  // === Vacances US (approx touristes) ===
  if (m===2) events.push({day:15,label:'🇺🇸 Spring Break',color:'#F59E0B'})
  if (m===3) events.push({day:15,label:'🇺🇸 Fin Spring Br.',color:'#F59E0B'})
  if (m===5) events.push({day:10,label:'🇺🇸 Summer',color:'#F59E0B'})
  if (m===7) events.push({day:25,label:'🇺🇸 Fin Summer',color:'#F59E0B'})
  if (m===11) events.push({day:20,label:'🇺🇸 Xmas Break',color:'#F59E0B'})
  if (m===0) events.push({day:3,label:'🇺🇸 Fin Xmas Br.',color:'#F59E0B'})

  // === US fériés ===
  const memorialDay: Record<number,number> = {2024:27,2025:26,2026:25}
  if (m===4 && memorialDay[y]) events.push({day:memorialDay[y],label:'🇺🇸 Memorial Day',color:'#F59E0B'})
  const laborDay: Record<number,number> = {2024:2,2025:1,2026:7}
  if (m===8 && laborDay[y]) events.push({day:laborDay[y],label:'🇺🇸 Labor Day',color:'#F59E0B'})
  if (m===6) events.push({day:4,label:'🇺🇸 4th July',color:'#F59E0B'})
  const thanksgiving: Record<number,number> = {2024:28,2025:27,2026:26}
  if (m===10 && thanksgiving[y]) events.push({day:thanksgiving[y],label:'🇺🇸 Thanksgiving',color:'#F59E0B'})

  // === Black Friday + Cyber Monday ===
  if (m===10 && thanksgiving[y]) {
    events.push({day:thanksgiving[y]+1,label:'Black Friday',color:'#111'})
    events.push({day:thanksgiving[y]+4,label:'Cyber Monday',color:'#7C3AED'})
  }

  // === Golden Week Chine ===
  if (m===9) { events.push({day:1,label:'🇨🇳 Golden W.',color:'#EF4444'}); events.push({day:7,label:'🇨🇳 GW fin',color:'#EF4444'}) }

  // === Jours fériés FR ===
  if (m===0) events.push({day:1,label:'🇫🇷 Nouvel An',color:'#2563EB'})
  if (m===4) { events.push({day:1,label:'🇫🇷 1er Mai',color:'#2563EB'}); events.push({day:8,label:'🇫🇷 8 Mai',color:'#2563EB'}) }
  if (m===6) events.push({day:14,label:'🇫🇷 14 Juil.',color:'#2563EB'})
  if (m===7) events.push({day:15,label:'🇫🇷 15 Août',color:'#2563EB'})
  if (m===10) { events.push({day:1,label:'🇫🇷 Toussaint',color:'#2563EB'}); events.push({day:11,label:'🇫🇷 11 Nov',color:'#2563EB'}) }
  const paques: Record<number,[number,number]> = {2024:[2,31],2025:[3,20],2026:[3,5]}
  if (paques[y] && m===paques[y][0]) events.push({day:paques[y][1],label:'🇫🇷 Pâques',color:'#2563EB'})
  const ascension: Record<number,[number,number]> = {2024:[4,9],2025:[4,29],2026:[4,14]}
  if (ascension[y] && m===ascension[y][0]) events.push({day:ascension[y][1],label:'🇫🇷 Ascension',color:'#2563EB'})

  // === Fêtes commerciales ===
  if (m===1) events.push({day:14,label:'❤️ St Valentin',color:'#E11D48'})
  if (m===11) events.push({day:25,label:'🎄 Noël',color:'#16A34A'})
  const feteMeres: Record<number,[number,number]> = {2024:[4,26],2025:[4,25],2026:[4,31]}
  if (feteMeres[y] && m===feteMeres[y][0]) events.push({day:feteMeres[y][1],label:'💐 Fête mères',color:'#D946EF'})

  const daysInMonth = new Date(y, m+1, 0).getDate()
  return events.filter(e => e.day >= 1 && e.day <= daysInMonth)
}