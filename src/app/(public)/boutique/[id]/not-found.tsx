import Link from 'next/link'

export default function NotFound() {
  const fontHelvetica = '"Helvetica Neue", Helvetica, Arial, sans-serif'
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-white" style={{ fontFamily: fontHelvetica }}>
      <p className="uppercase text-xs tracking-widest mb-6" style={{ color: '#999' }}>
        Produit introuvable
      </p>
      <Link href="/boutique" className="uppercase text-xs tracking-widest hover:opacity-50 transition">
        ← Retour à la boutique
      </Link>
    </div>
  )
}
