# Modules NR

Chaque sous-dossier ici est un **module métier indépendant**, vendable séparément.

| Module | Dossier | Routes UI | Routes API |
|---|---|---|---|
| Dépôt-vente | _historique, dispersé dans `src/app/{deposante,chineuse,vendeuse,admin}`_ | `/deposante/*`, `/chineuse/*`, `/vendeuse/*` (parties dépôt) | `/api/deposant*`, `/api/factures/*` |
| Achat | `src/modules/achat/` | `/achat/*` (à créer) | `/api/achat/*` (à créer) |
| Stock | _partagé, dans `src/app/admin/{nos-produits,inventaires}`_ | `/admin/nos-produits`, `/admin/inventaires` | `/api/produits/*` |

Règles :
- Un module ne doit **pas importer** de code d'un autre module.
- Le code partagé (auth, Firebase, UI commune) reste dans `src/lib/` et `src/components/`.
- Activation/désactivation par compte : `src/lib/modules.ts`.

Le dépôt-vente n'a pas (encore) été déplacé dans `src/modules/depot-vente/` pour ne pas casser des dizaines d'imports. Si on revend, on documente "le dépôt-vente = ces fichiers-là" et c'est suffisant.
