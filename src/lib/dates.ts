import { useState } from "react";
import type { ContentListItem } from "@/lib/hooks/use-contents";

/** YYYY-MM-DD en heure locale (pas toISOString, qui bascule en UTC). */
export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Lundi de la semaine contenant `d`. */
export function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

/** `iso` décalé de `n` jours, en heure locale (insensible aux changements d'heure). */
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toIso(d);
}

/** `n` jours consécutifs à partir de `start` inclus. */
export function daysFrom(start: string, n = 7): string[] {
  return Array.from({ length: n }, (_, i) => addDays(start, i));
}

/** Samedi ou dimanche (d'après la date, pas la position dans la grille). */
export function isWeekend(iso: string): boolean {
  const day = new Date(iso + "T00:00:00").getDay();
  return day === 0 || day === 6;
}

/** Grille du mois : semaines complètes (lundi → dimanche). */
export function monthGrid(year: number, month: number): string[][] {
  const first = new Date(year, month, 1);
  const start = mondayOf(first);
  const weeks: string[][] = [];
  const cursor = new Date(start);
  do {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(toIso(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  } while (cursor.getMonth() === month);
  return weeks;
}

/** Date du jour, figée au montage du composant (la page ne reste pas ouverte des jours). */
export function useToday(): string {
  const [today] = useState(() => toIso(new Date()));
  return today;
}

/** En retard = date prévue passée et toujours pas publié (ni archivé). */
export function isLate(c: ContentListItem, today: string): boolean {
  return (
    c.planned !== null &&
    c.planned < today &&
    c.status !== "published" &&
    c.status !== "archived"
  );
}

/** Tri : retards d'abord, puis par date prévue croissante, sans date à la fin. */
export function byPlanned(a: ContentListItem, b: ContentListItem): number {
  if (a.planned && b.planned) return a.planned.localeCompare(b.planned);
  if (a.planned) return -1;
  if (b.planned) return 1;
  return b.created.localeCompare(a.created);
}

/**
 * Jour où un contenu apparaît dans le calendrier : un contenu publié à sa date
 * de publication, les autres à leur date prévue. La grille ET la cadence
 * utilisent cette règle, pour qu'un compteur corresponde toujours aux cartes.
 */
export function calendarDate(c: ContentListItem): string | null {
  return c.status === "published"
    ? (c["published-at"] ?? c.planned)
    : (c.planned ?? c["published-at"]);
}

/** Semaine (lundi → dimanche) contenant `iso` — bornes par défaut d'un thème. */
export function weekRange(iso: string): { start: string; end: string } {
  const start = toIso(mondayOf(new Date(iso + "T00:00:00")));
  return { start, end: addDays(start, 6) };
}

/**
 * Numéro de semaine absolu (lundi 2026-01-05 = 0). Sert à donner une couleur
 * aux thèmes : deux semaines voisines ne peuvent pas tomber sur la même.
 */
export function weekIndex(iso: string): number {
  const monday = weekRange(iso).start;
  const days = Math.round(
    (Date.parse(`${monday}T00:00:00Z`) - Date.parse("2026-01-05T00:00:00Z")) / 86400000,
  );
  return Math.floor(days / 7);
}

/**
 * Ordre du calendrier : par date affichée, les fiches sans date à la fin
 * (les plus récentes d'abord). Sert de repli à la navigation entre fiches
 * quand on n'en ouvre pas une depuis une liste.
 */
export function byCalendarDate(a: ContentListItem, b: ContentListItem): number {
  const da = calendarDate(a);
  const db = calendarDate(b);
  if (da && db) return da.localeCompare(db) || a.title.localeCompare(b.title);
  if (da) return -1;
  if (db) return 1;
  return b.created.localeCompare(a.created);
}
