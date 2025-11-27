// components/ConditionalBackground.tsx
'use client'

import { usePathname } from 'next/navigation'
import BackgroundWords from './BackgroundWords'

export default function ConditionalBackground() {
  const pathname = usePathname()
  
  // Pages privées où on masque le fond
  const pagesPrivees = [
    '/formulaire',
    '/mes-produits',
    '/mes-ventes',
    '/admin',
    '/vendeuse',
  ]
  
  // Ne pas afficher sur les pages privées
  if (pagesPrivees.some(p => pathname?.startsWith(p))) {
    return null
  }
  
  return <BackgroundWords />
}