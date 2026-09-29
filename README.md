# Torch (version solo)

Torch est le planning de contenus qu'on utilise chez Unkillable Companies : calendrier, kanban, bibliothèque et suivi des performances.

Il n'a pas de base de données. **Ton vault Obsidian est la base de données.** Chaque contenu est une note markdown dans le dossier `Torch/` de ton vault. Torch et Obsidian lisent et écrivent les mêmes fichiers.

Cette version tourne sur ton Mac, dans ton navigateur, à l'adresse http://localhost:3944. Rien ne part sur un serveur.

## Installer

Il faut **Node.js** (version LTS, sur https://nodejs.org/fr/download) et **Obsidian**.

Ouvre le Terminal et colle :

```bash
git clone https://github.com/go-silex/torch-solo.git ~/Torch && ~/Torch/install.sh
```

L'installeur :

1. vérifie Node.js ;
2. ouvre une fenêtre pour choisir le dossier de ton vault Obsidian ;
3. crée le dossier `Torch/` dans ton vault, avec une fiche d'exemple (rien d'existant n'est écrasé) ;
4. prépare l'application (2-3 minutes la première fois) ;
5. pose deux raccourcis sur ton Bureau : **Torch** et **Arrêter Torch** ;
6. ouvre Torch dans ton navigateur.

Si macOS demande l'accès à un dossier (Documents, iCloud, Google Drive), accepte : c'est Torch qui lit ton vault.

## Au quotidien

- **Ouvrir** : double-clic sur **Torch** sur le Bureau. Le Terminal s'ouvre une seconde, puis le navigateur. Tu peux fermer le Terminal.
- **Arrêter** : double-clic sur **Arrêter Torch**. Sinon Torch s'arrête quand tu éteins le Mac.
- **Créer un contenu** : touche `N`, un titre, Entrée.
- **Planifier** : glisse une carte sur un jour du calendrier.
- **Avancer** : glisse une carte dans le kanban (Idée, Brouillon, Prêt, Planifié, Publié).
- **Écrire** : dans la fiche Torch, ou dans la note depuis Obsidian (lien « Ouvrir dans Obsidian »).
- **Chercher** : `⌘K`.

Deux émetteurs sont prévus : **Caroline** (ton compte) et **@Ryse** (la marque). Chacun a son dossier : `Torch/Content/Caroline/` et `Torch/Content/Ryse/`.

## Ce que tu peux régler

- **Objectifs par semaine** : `Torch/_Config/Targets.md` dans Obsidian, ou « Ajuster les objectifs » dans Torch.
- **Rythme de la semaine** et règles éditoriales : onglet Rules.
- **Thème de la semaine** : bouton « Thème » au-dessus du calendrier.
- **Réglages machine** : `~/.config/torch/torch.env` (prénom qui signe les modifications, nom du dossier Torch dans le vault).

## Mettre à jour

```bash
~/Torch/scripts/update.sh
```

## Désinstaller

Double-clic sur **Arrêter Torch**, puis supprime `~/Torch`, `~/.config/torch` et les deux raccourcis du Bureau. Tes fiches restent dans ton vault.

## Ce qui n'est pas dans cette version

Les intégrations internes d'Unkillable Companies sont retirées : montage vidéo (Flame), liens courts (Shlink), illustrations (Rocky). Les images de posts s'importent depuis ton ordinateur et vont dans `Torch/_Assets/Images/`.

Torch ne tourne que quand ton Mac est allumé. Si ton vault est synchronisé (iCloud, Google Drive), tes fiches le sont aussi, mais n'ouvre Torch que sur un seul Mac à la fois.

## Si ça coince

- Le journal est dans `~/Library/Logs/torch.log`.
- Relancer l'installeur ne casse rien : `~/Torch/install.sh`.
- Tu peux aussi ouvrir Claude Code dans `~/Torch` et lui demander : le fichier `CLAUDE.md` lui explique l'app.
