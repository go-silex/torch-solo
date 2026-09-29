import { z } from "zod";

/**
 * Règles éditoriales — `_Config/Rules.md`.
 *
 * Deux parties : un rythme hebdomadaire structuré (un intitulé par jour, que
 * le calendrier peut afficher) et un corps markdown libre pour tout le reste.
 * Le fichier s'ouvre et se modifie aussi bien dans Obsidian que dans Torch.
 */

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: "Lundi",
  tuesday: "Mardi",
  wednesday: "Mercredi",
  thursday: "Jeudi",
  friday: "Vendredi",
  saturday: "Samedi",
  sunday: "Dimanche",
};

export type Rhythm = Partial<Record<Weekday, string>>;

/** Garde les seules clés de jour connues, en chaînes : le reste est ignoré. */
export function toRhythm(value: unknown): Rhythm {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const out: Rhythm = {};
  for (const day of WEEKDAYS) {
    const v = source[day];
    if (typeof v === "string" && v.trim()) out[day] = v.trim().slice(0, 80);
  }
  return out;
}

export type Rules = { rhythm: Rhythm; body: string };

/** Ce que l'interface envoie : l'un, l'autre, ou les deux. */
export const RulesInputSchema = z
  .object({
    rhythm: z.record(z.string(), z.string().max(80)).optional(),
    body: z.string().max(100_000).optional(),
  })
  .refine((r) => r.rhythm !== undefined || r.body !== undefined, {
    message: "Rien à enregistrer",
  });
export type RulesInput = z.infer<typeof RulesInputSchema>;

/** Rythme proposé au premier lancement, à réécrire dans l'onglet Rules. */
export const DEFAULT_RHYTHM: Rhythm = {
  monday: "Histoire terrain",
  tuesday: "Conseil concret",
  wednesday: "Coulisses de Ryse",
  thursday: "Opinion",
  friday: "Question à la communauté",
};

/** Jour de la semaine d'une date ISO, en clé de rythme. */
export function weekdayOf(iso: string): Weekday {
  const day = new Date(iso + "T00:00:00").getDay();
  return WEEKDAYS[(day + 6) % 7];
}

/** Intitulé du jour, ou null si ce jour n'en porte pas. */
export function rhythmFor(rhythm: Rhythm, iso: string): string | null {
  const value = rhythm[weekdayOf(iso)];
  return value && value.trim() ? value : null;
}
