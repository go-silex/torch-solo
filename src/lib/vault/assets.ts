import path from "node:path";
import { getAssetsRoot } from "@/lib/config";

/**
 * Résout le chemin d'un asset (vignette) en garantissant qu'il reste DANS le
 * Drive silex-assets. Le chemin vient du frontmatter, donc éditable à la main
 * dans Obsidian : sans ce garde-fou, un `../../..` ferait servir n'importe quel
 * fichier de la machine.
 *
 * Le frontmatter stocke un chemin RELATIF à la racine de silex-assets
 * (ex. "Torch_Vignettes/2026-08-07_Titre.png") : les Mac ont des chemins
 * absolus différents, seule la position dans le Drive est partagée.
 */
export function resolveAssetPath(relative: string): string | null {
  const root = getAssetsRoot();
  if (!root) return null;
  const abs = path.resolve(root, relative);
  return abs.startsWith(root + path.sep) ? abs : null;
}
