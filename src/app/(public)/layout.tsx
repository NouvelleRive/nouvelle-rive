// src/app/(public)/layout.tsx
import NavbarPublic from '@/components/NavbarPublic'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <NavbarPublic />
      {children}
    </>
  )
}