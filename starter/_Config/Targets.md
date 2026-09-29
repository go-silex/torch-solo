---
type: torch-config
weekly-targets:
  caroline:
    post: 3
waterfall-expected:
  toolkit: 1
  essay: 1
  post: [4, 6]
  short: [3, 5]
---

# Objectifs Torch

- `weekly-targets` : combien de contenus par semaine, par émetteur (`caroline`, `ryse`) et par format (`post`, `short`, `newsletter`…).
- `waterfall-expected` : ce qu'on attend comme dérivés d'un contenu long (épisode). Un nombre = exact, `[min, max]` = fourchette.
