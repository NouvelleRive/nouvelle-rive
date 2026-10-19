'use client'

// Écran de confirmation avant publication TikTok.
// Imposé par TikTok pour le Direct Post (video.publish) : on doit montrer le
// compte connecté, laisser choisir la confidentialité (rien de pré-sélectionné),
// refléter les réglages d'interaction du compte, proposer la déclaration de
// contenu commercial et afficher les mentions légales avant de publier.
// Si l'app n'a pas encore video.publish, la même feuille sert à envoyer en
// brouillon (comportement historique).

import { useEffect, useState } from 'react'

export type TikTokPostOptions = {
  privacyLevel?: string
  disableComment?: boolean
  disableDuet?: boolean
  disableStitch?: boolean
  brandOrganic?: boolean
  brandContent?: boolean
}

type CreatorInfo = {
  creator_avatar_url?: string
  creator_username?: string
  creator_nickname?: string
  privacy_level_options?: string[]
  comment_disabled?: boolean
  duet_disabled?: boolean
  stitch_disabled?: boolean
  max_video_post_duration_sec?: number
}

const PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: 'Tout le monde',
  MUTUAL_FOLLOW_FRIENDS: 'Amis (abonnements mutuels)',
  FOLLOWER_OF_CREATOR: 'Abonnés',
  SELF_ONLY: 'Moi uniquement (privé)',
}

const MUSIC_URL = 'https://www.tiktok.com/legal/page/global/music-usage-confirmation/en'
const BC_URL = 'https://www.tiktok.com/legal/page/global/bc-policy/en'

export default function TikTokPostSheet({
  open,
  isPhoto,
  posting,
  onClose,
  onPublish,
}: {
  open: boolean
  isPhoto: boolean
  posting: boolean
  onClose: () => void
  onPublish: (opts: TikTokPostOptions) => void
}) {
  const [loading, setLoading] = useState(true)
  const [direct, setDirect] = useState(false)
  const [info, setInfo] = useState<CreatorInfo | null>(null)
  const [error, setError] = useState('')

  const [privacy, setPrivacy] = useState('')           // rien de pré-sélectionné
  const [allowComment, setAllowComment] = useState(true)
  const [allowDuet, setAllowDuet] = useState(true)
  const [allowStitch, setAllowStitch] = useState(true)
  const [disclose, setDisclose] = useState(false)
  const [brandOrganic, setBrandOrganic] = useState(false)
  const [brandContent, setBrandContent] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError('')
    fetch('/api/tiktok/creator-info')
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) throw new Error(d.error || 'Erreur')
        setDirect(!!d.direct)
        setInfo(d.info || null)
      })
      .catch((e) => setError(e?.message || 'Erreur'))
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  // « Contenu de marque » interdit en privé (règle TikTok).
  const privacyOptions = (info?.privacy_level_options || []).filter(
    (o) => !(brandContent && o === 'SELF_ONLY'),
  )
  const discloseInvalid = disclose && !brandOrganic && !brandContent
  const canPublish = !posting && (!direct || (!!privacy && !discloseInvalid))

  const submit = () => {
    if (!direct) return onPublish({})
    onPublish({
      privacyLevel: privacy,
      disableComment: !allowComment,
      disableDuet: !allowDuet,
      disableStitch: !allowStitch,
      brandOrganic: disclose && brandOrganic,
      brandContent: disclose && brandContent,
    })
  }

  const Check = ({
    checked,
    onChange,
    label,
    hint,
    disabled,
  }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) => (
    <label className={`flex items-start gap-2 py-1.5 ${disabled ? 'opacity-40' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-[#22209C]"
      />
      <span className="text-sm text-gray-800">
        {label}
        {hint && <span className="block text-xs text-gray-400">{hint}</span>}
      </span>
    </label>
  )

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-medium text-gray-900">Publier sur TikTok</h3>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none px-2">×</button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-6 text-center">Chargement du compte…</p>
        ) : error ? (
          <p className="text-sm text-red-600 py-4">{error}</p>
        ) : (
          <>
            {/* Compte connecté */}
            <div className="flex items-center gap-2.5 border border-gray-200 rounded-lg p-2.5 mb-3">
              {info?.creator_avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={info.creator_avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gray-100" />
              )}
              <div className="min-w-0">
                <p className="text-sm text-gray-900 truncate">{info?.creator_nickname || 'Compte TikTok connecté'}</p>
                {info?.creator_username && <p className="text-xs text-gray-400 truncate">@{info.creator_username}</p>}
              </div>
            </div>

            {!direct ? (
              <p className="text-sm text-gray-600 mb-4">
                L’app n’a pas encore l’autorisation de publication directe : le contenu part en
                <strong> brouillon</strong> dans ton TikTok, tu finalises et tu publies depuis l’app.
              </p>
            ) : (
              <>
                {/* Confidentialité : aucun choix par défaut */}
                <label className="block text-sm text-gray-800 mb-1">Qui peut voir cette publication&nbsp;*</label>
                <select
                  value={privacy}
                  onChange={(e) => setPrivacy(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3"
                >
                  <option value="">Sélectionner…</option>
                  {privacyOptions.map((o) => (
                    <option key={o} value={o}>{PRIVACY_LABELS[o] || o}</option>
                  ))}
                </select>

                {/* Interactions, grisées si désactivées sur le compte */}
                <p className="text-sm text-gray-800 mb-0.5">Interactions</p>
                <Check
                  checked={allowComment && !info?.comment_disabled}
                  disabled={!!info?.comment_disabled}
                  onChange={setAllowComment}
                  label="Autoriser les commentaires"
                  hint={info?.comment_disabled ? 'désactivé sur le compte TikTok' : undefined}
                />
                {!isPhoto && (
                  <>
                    <Check
                      checked={allowDuet && !info?.duet_disabled}
                      disabled={!!info?.duet_disabled}
                      onChange={setAllowDuet}
                      label="Autoriser les duos"
                      hint={info?.duet_disabled ? 'désactivé sur le compte TikTok' : undefined}
                    />
                    <Check
                      checked={allowStitch && !info?.stitch_disabled}
                      disabled={!!info?.stitch_disabled}
                      onChange={setAllowStitch}
                      label="Autoriser les montages"
                      hint={info?.stitch_disabled ? 'désactivé sur le compte TikTok' : undefined}
                    />
                  </>
                )}

                {/* Déclaration de contenu commercial */}
                <div className="border-t border-gray-100 mt-3 pt-3">
                  <Check
                    checked={disclose}
                    onChange={(v) => { setDisclose(v); if (!v) { setBrandOrganic(false); setBrandContent(false) } }}
                    label="Divulguer le contenu commercial"
                    hint="À activer si la publication fait la promotion d’une marque ou d’un produit."
                  />
                  {disclose && (
                    <div className="pl-6">
                      <Check
                        checked={brandOrganic}
                        onChange={setBrandOrganic}
                        label="Votre marque"
                        hint="Promotion de NOUVELLE RIVE ou de ses propres produits."
                      />
                      <Check
                        checked={brandContent}
                        onChange={(v) => { setBrandContent(v); if (v && privacy === 'SELF_ONLY') setPrivacy('') }}
                        label="Contenu de marque"
                        hint="Partenariat rémunéré avec une autre marque (impossible en privé)."
                      />
                      {discloseInvalid && (
                        <p className="text-xs text-red-600 mt-1">Choisis « Votre marque » et/ou « Contenu de marque ».</p>
                      )}
                      {(brandOrganic || brandContent) && (
                        <p className="text-xs text-gray-500 mt-1">
                          La publication sera signalée&nbsp;:{' '}
                          {brandContent ? '« Partenariat rémunéré »' : '« Contenu promotionnel »'}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Mentions imposées par TikTok */}
                <p className="text-xs text-gray-400 mt-3">
                  En publiant, tu acceptes{' '}
                  {brandContent && (
                    <>
                      la <a href={BC_URL} target="_blank" rel="noreferrer" className="underline">Politique de contenu de marque</a>{' '}et{' '}
                    </>
                  )}
                  la <a href={MUSIC_URL} target="_blank" rel="noreferrer" className="underline">Confirmation d’utilisation de la musique</a> de TikTok.
                </p>
              </>
            )}

            <button
              onClick={submit}
              disabled={!canPublish}
              className="w-full bg-[#22209C] text-white text-sm font-medium rounded-lg py-2.5 mt-4 disabled:opacity-40"
            >
              {posting ? 'Envoi…' : direct ? 'Publier sur TikTok' : 'Envoyer en brouillon'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
