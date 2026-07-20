'use client'

// Page temporaire de reproduction du bug de focus sur le formulaire iconiques.
// À supprimer une fois le diagnostic terminé.
import IconiquesManager from '@/components/admin/IconiquesManager'

export default function DevFocusRepro() {
  return <IconiquesManager typeFilter="vintage" />
}
