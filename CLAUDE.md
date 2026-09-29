# Torch solo : guide agent

App Next 16 locale (port 3944), **sans base de données** : le vault Obsidian de l'utilisatrice est la source de vérité, dans `<vault>/Torch/Content/`. Voir README.md pour l'usage.

## Config machine

- Vault : `~/.config/torch/vault-root` (écrit par `install.sh`), ou `TORCH_VAULT_ROOT`.
- Réglages : `~/.config/torch/torch.env` (`TORCH_OPERATOR`, `TORCH_ZONE`, `TORCH_OBSIDIAN_VAULT`, `TORCH_ASSETS_ROOT`).
- Images : `<vault>/Torch/_Assets/Images/`.
- Émetteurs : `caroline` et `ryse`, définis dans `src/lib/types/content.ts` (`EMITTERS`, `EMITTER_DIRS`) et `src/lib/labels.ts`.

## Layer rules

`app/api` → `services` → `vault`. Les composants React ne touchent jamais `services/` ni `vault/` directement : ils passent par les routes API (hooks dans `lib/hooks/`).

## Invariants à ne jamais casser (src/lib/vault/)

1. Le **corps** d'une note est restitué octet pour octet, jamais re-sérialisé.
2. La sérialisation du frontmatter est **déterministe** (ordre `CANONICAL_KEY_ORDER`) et idempotente.
3. YAML lu en **CORE_SCHEMA** (le schéma par défaut convertirait `2026-08-06` en Date).
4. `ContentPatchSchema` ne porte **jamais** de `.default()` : chaque PATCH écraserait les autres champs.
5. Toute écriture passe par la file par fiche (`enqueue`) et `rememberWrite` (détection d'écho).
6. Tests et dev : `TORCH_VAULT_ROOT=/tmp/un-vault-jetable`. Ne jamais tester sur le vrai vault.

## Commandes

`npm run dev` · `npm run lint` · `npm run test:run` · `./install.sh` · `./scripts/update.sh`

## Retiré de cette version

Flame, Shlink et Rocky (intégrations internes d'Unkillable Companies) : les pollers sont coupés (`src/instrumentation.ts`) et les boutons retirés de l'interface. Le code client reste dans `src/lib/services/` mais n'est plus appelé.
