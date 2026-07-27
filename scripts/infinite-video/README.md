# Vidéos « infinite casting »

Génère les bandeaux infinis verticaux (1080×1920, format Reel/Story) pour une chineuse :
deux rangées d'images qui défilent en sens opposés, logo `NOUVELLE RIVE` + nom de la chineuse
en bleu Klein (`#22209C`) au centre. Muet par défaut, ou avec ta voix + sous-titres mot par mot.

Les vidéos sortent dans `~/Desktop/videos-ig-infinite/` (modifiable avec `--out`).

## Installation (une seule fois)

```bash
brew install ffmpeg                      # si pas déjà fait
cd scripts/infinite-video
npm install playwright
npx playwright install chromium
```

## Utilisation

Depuis `scripts/infinite-video/` :

```bash
# 20 pièces les plus récentes, muet, 2 rangées + 1 rangée
node make-infinite.mjs frusques

# toutes les pièces de la chineuse
node make-infinite.mjs strass-chronique --all

# pièces précises, dans un ordre imposé (par SKU)
node make-infinite.mjs casting-archives --skus "CAS10 CAS3 CAS2 CAS32 CAS24"

# une seule version
node make-infinite.mjs brujas --layout 2rangs      # ou 1rang

# avec ta voix (m4a/mp4/wav) + sous-titres mot par mot
node make-infinite.mjs casting-archives \
  --skus "CAS10 CAS3 CAS2" \
  --voice "~/Downloads/voix off Casting Archives.m4a" \
  --text ./casting.txt
```

Le `slug` de la chineuse = ce qui est dans l'URL `nouvellerive.eu/nos-creatrices/<slug>`.

## Options

| Option | Effet |
|---|---|
| `--all` | toutes les pièces (sinon les 20 plus récentes) |
| `--skus "A B C"` | liste de SKU, dans l'ordre voulu (prioritaire) |
| `--layout both\|2rangs\|1rang` | quelles versions générer (défaut `both`) |
| `--voice <fichier>` | intègre un audio ; sinon muet |
| `--text <fichier>` | texte lu → sous-titres mot par mot (avec `--voice`) |
| `--out <dossier>` | dossier de sortie (défaut `~/Desktop/videos-ig-infinite`) |
| `--local` | lit les données du serveur dev (`http://127.0.0.1:3000`) au lieu de la prod |

## Notes

- Par défaut le script lit les données sur **le site en prod** (`nouvellerive.eu`) : pas besoin de lancer `npm run dev`.
- La voix n'est **pas** retouchée (pas de nettoyage). Les sous-titres sont synchronisés au prorata de la longueur des mots sur la durée de l'audio.
- Boucle sans couture : la vidéo peut tourner en continu sur Instagram.
