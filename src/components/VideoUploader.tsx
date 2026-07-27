'use client'

import { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { compressVideoToMp4 } from '@/lib/compressVideo'

// Limite Vercel body ~4,5 Mo → cible 3,2 Mo (base64 ~4,3 Mo, sous la limite)
const MAX_SIZE = 3.2 * 1024 * 1024

function uint8ArrayToBase64(uint8Array: Uint8Array): string {
  const CHUNK_SIZE = 0x8000 // 32KB chunks
  const chunks: string[] = []
  for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
    const chunk = uint8Array.subarray(i, i + CHUNK_SIZE)
    chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]))
  }
  return btoa(chunks.join(''))
}

type Props = {
  /** URL de la vidéo actuelle ('' si aucune) */
  value: string
  /** Appelé avec la nouvelle URL, ou '' quand on supprime */
  onChange: (url: string) => void
  /** Sert à nommer le fichier dans Bunny (ex: le SKU) */
  skuHint?: string
  className?: string
}

/**
 * Uploader vidéo réutilisable pour les fiches produit.
 * Compresse automatiquement (navigateur, son coupé) toute vidéo > 3,2 Mo
 * avant l'upload vers Bunny. Sortie MP4 lisible partout.
 */
export default function VideoUploader({ value, onChange, skuHint, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')

  const handleFile = async (file: File) => {
    if (!/\.(mp4|mov|m4v)$/i.test(file.name) && !file.type.startsWith('video/')) {
      alert('Format vidéo non reconnu. Utilisez un fichier .mp4')
      return
    }
    setUploading(true)
    try {
      // Ré-encode toujours : supprime le son sur TOUTES les vidéos + compresse si trop lourde
      setStatus('Traitement de la vidéo…')
      const processed = await compressVideoToMp4(file, MAX_SIZE, setStatus)
      if (processed) {
        if (processed.size > MAX_SIZE) {
          alert(`Même compressée, la vidéo fait ${(processed.size / 1024 / 1024).toFixed(1)} Mo. Merci de la raccourcir un peu (vidéo trop longue).`)
          return
        }
        file = new File([processed], file.name.replace(/\.[^.]+$/, '') + '.mp4', { type: 'video/mp4' })
      } else if (file.size > MAX_SIZE) {
        // Navigateur incapable de ré-encoder ET fichier trop lourd → on bloque
        alert(`La vidéo fait ${(file.size / 1024 / 1024).toFixed(1)} Mo et votre navigateur ne sait pas la compresser. Réduisez-la à moins de 3,2 Mo, ou utilisez Chrome/Safari.`)
        return
      }
      // (si processed === null mais fichier léger : upload tel quel, son conservé faute de mieux)

      setStatus('Upload en cours…')
      const buf = new Uint8Array(await file.arrayBuffer())
      const base64 = uint8ArrayToBase64(buf)
      const timestamp = Date.now()
      const random = Math.random().toString(36).substring(2, 8)
      const skuPart = (skuHint || 'produit').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
      const path = `produits/videos/${skuPart}_${timestamp}_${random}.mp4`
      const res = await fetch('/api/upload-bunny', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, path, contentType: 'video/mp4' }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'upload failed')
      onChange(data.url)
    } catch (err: any) {
      console.error('Erreur upload vidéo:', err)
      alert(`Erreur upload vidéo : ${err?.message || err}. Réessayez, ou choisissez une vidéo plus légère.`)
    } finally {
      setUploading(false)
      setStatus('')
    }
  }

  return (
    <div className={`space-y-2 ${className || ''}`}>
      <label className="block text-xs font-medium text-gray-600">
        Vidéo <span className="text-gray-400 font-normal">(optionnel)</span>
      </label>
      <p className="text-[10px] text-gray-400 leading-tight">Formats acceptés : .mp4 · compressée automatiquement si trop lourde</p>

      {value && (
        <div className="relative group">
          <video src={value} className="w-full h-32 object-cover rounded border bg-black" muted playsInline controls />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
            title="Supprimer la vidéo"
          >
            <X size={14} />
          </button>
          <span className="absolute bottom-1 left-1 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded">✓</span>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          e.currentTarget.classList.add('border-blue-500', 'bg-blue-100')
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove('border-blue-500', 'bg-blue-100')
        }}
        onDrop={(e) => {
          e.preventDefault()
          e.currentTarget.classList.remove('border-blue-500', 'bg-blue-100')
          const file = e.dataTransfer.files[0]
          if (file && (file.type.startsWith('video/') || /\.(mp4|mov|m4v)$/i.test(file.name))) {
            handleFile(file)
          } else {
            alert('Veuillez déposer une vidéo (.mp4)')
          }
        }}
        className="border-2 border-dashed border-gray-300 rounded p-2 text-center transition-colors"
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-blue-600 h-12">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-xs">{status || 'Upload en cours…'}</span>
          </div>
        ) : (
          <label className="cursor-pointer block h-12 flex items-center justify-center">
            <div className="flex items-center gap-2 text-gray-500">
              <Upload size={16} />
              <span className="text-xs">{value ? 'Remplacer' : 'Ajouter une vidéo'}</span>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/quicktime,.mp4,.mov,.m4v"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
                e.target.value = ''
              }}
              className="hidden"
            />
          </label>
        )}
      </div>
    </div>
  )
}
