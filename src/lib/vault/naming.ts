import { existsSync } from "node:fs";
import path from "node:path";
import {
  EMITTER_DIRS,
  FORMAT_DIRS,
  type Emitter,
  type Format,
} from "@/lib/types/content";
import { slugifyTitle } from "@/lib/vault/slug";

/**
 * Nommage des fichiers de la zone Torch.
 * Convention vault : ASCII sans accents ni espaces, Title_Case avec underscores,
 * date de CRÉATION en préfixe : YYYY-MM-DD_Titre_Court.md
 */

export { slugifyTitle };

/** Dossier canonique d'une fiche selon son émetteur et son format. */
export function canonicalDir(
  contentDir: string,
  emitter: Emitter,
  format: Format,
): string {
  return path.join(contentDir, EMITTER_DIRS[emitter], FORMAT_DIRS[format]);
}

/**
 * Génère un id (= nom de fichier sans .md) unique dans le dossier cible ET
 * parmi les fiches déjà connues (`isTaken`) : le store indexe par id toutes
 * émetteurs et formats confondus, deux dossiers ne peuvent donc pas partager
 * un nom. Suffixe _2, _3… en cas de collision.
 */
export function generateId(
  dir: string,
  created: string,
  title: string,
  isTaken: (id: string) => boolean = () => false,
): string {
  const base = `${created}_${slugifyTitle(title)}`;
  let candidate = base;
  let i = 2;
  while (isTaken(candidate) || existsSync(path.join(dir, `${candidate}.md`))) {
    candidate = `${base}_${i}`;
    i += 1;
  }
  return candidate;
}
