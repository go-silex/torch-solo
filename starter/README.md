# Torch

Ce dossier est la base de données de Torch, ton planning de contenus.

- **Une fiche = un fichier** dans `Content/<Émetteur>/<Format>/`, nommé `AAAA-MM-JJ_Titre.md` (date de création, jamais renommé).
- **Tout l'état vit dans le frontmatter** (`status`, `planned`, plateformes, métriques). Le fichier ne change jamais de dossier : le kanban est virtuel.
- Tu peux **modifier librement dans Obsidian** : Torch voit le changement en quelques secondes. Et tout ce que tu fais dans Torch s'écrit ici.
- Ne supprime pas la ligne `type: torch-content` : c'est elle qui fait d'un fichier une fiche Torch. Un fichier au frontmatter cassé part « en quarantaine » dans la Bibliothèque de Torch, il n'est jamais réécrit.
- `_Config/Targets.md` : tes objectifs par semaine. `_Config/Rules.md` et `_Config/Themes.md` apparaissent quand tu remplis les onglets Rules et Thèmes.
- Les images de posts vont dans `_Assets/Images/`.
