import { z } from "zod";

/**
 * Thème éditorial : une période nommée, affichée en bandeau au-dessus du
 * calendrier. Dans la quasi-totalité des cas c'est « la semaine », mais les
 * bornes sont libres (3 jours, 2 semaines) — c'est la même donnée.
 *
 * Vit dans `_Config/Themes.md`, hors du dossier `Content/` : ce fichier
 * n'entre ni dans le cache des fiches, ni dans le watcher, ni dans aucune
 * liste. Il est lisible et éditable à la main dans Obsidian.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const IsoDate = z
  .string()
  .regex(ISO_DATE, "Date attendue au format AAAA-MM-JJ");

export const ThemeSchema = z.object({
  id: z.string().min(1),
  start: IsoDate,
  end: IsoDate,
  label: z.string().min(1).max(140),
});
export type Theme = z.infer<typeof ThemeSchema>;

/** Contenu de `_Config/Themes.md`. Tolérant : une entrée cassée ne perd pas les autres. */
export const ThemesFileSchema = z
  .object({
    type: z.literal("torch-config"),
    themes: z.array(z.unknown()).default([]),
  })
  .loose();

/** Ce que l'interface envoie : pas d'id (le serveur le fabrique), fin ≥ début. */
export const ThemeInputSchema = z
  .object({
    start: IsoDate,
    end: IsoDate,
    label: z.string().trim().min(1, "Donne un nom au thème").max(140),
  })
  .refine((t) => t.end >= t.start, {
    message: "La fin ne peut pas précéder le début",
    path: ["end"],
  });
export type ThemeInput = z.infer<typeof ThemeInputSchema>;

/** Deux périodes se chevauchent-elles ? (bornes incluses) */
export function overlaps(
  a: { start: string; end: string },
  b: { start: string; end: string },
): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** Thèmes croisant la période affichée, du plus ancien au plus récent. */
export function themesInRange(
  themes: Theme[],
  start: string,
  end: string,
): Theme[] {
  return themes
    .filter((t) => overlaps(t, { start, end }))
    .sort(
      (a, b) =>
        a.start.localeCompare(b.start) || a.label.localeCompare(b.label),
    );
}
