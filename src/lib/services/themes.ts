import path from "node:path";
import { getTorchZone } from "@/lib/config";
import {
  enqueueWrite,
  readConfigDoc,
  writeConfigDoc,
  yamlString,
} from "@/lib/services/config-file";
import { ThemeSchema, overlaps, type Theme, type ThemeInput } from "@/lib/types/theme";

/**
 * Thèmes éditoriaux — `_Config/Themes.md` (voir `config-file.ts` pour les
 * garanties : hors du cache des fiches, corps markdown préservé).
 */

const DEFAULT_BODY = `
# Thèmes éditoriaux

Une ligne par période nommée. Normalement une semaine (lundi → dimanche), mais
les bornes sont libres. Édite plutôt depuis Torch (bandeau au-dessus du
calendrier) : ce fichier est réécrit à chaque enregistrement.
`;

function themesFile(): string {
  return path.join(getTorchZone().configDir, "Themes.md");
}

/** Id lisible dans le vault : date de début + suffixe court. */
function makeId(start: string): string {
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${start}-${suffix}`;
}

type ThemesDoc = { themes: Theme[]; body: string };

async function readDoc(): Promise<ThemesDoc> {
  const { data, body } = await readConfigDoc(themesFile(), DEFAULT_BODY);
  const raw = Array.isArray(data.themes) ? data.themes : [];
  // Tolérant : une entrée invalide est ignorée, les autres survivent.
  const themes: Theme[] = [];
  for (const entry of raw) {
    const parsed = ThemeSchema.safeParse(entry);
    if (parsed.success) themes.push(parsed.data);
  }
  return { themes, body };
}

async function writeDoc(doc: ThemesDoc): Promise<void> {
  const sorted = [...doc.themes].sort(
    (a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id),
  );
  const lines: string[] = [];
  if (sorted.length === 0) {
    lines.push("themes: []");
  } else {
    lines.push("themes:");
    for (const t of sorted) {
      lines.push(`  - id: ${t.id}`);
      lines.push(`    start: ${t.start}`);
      lines.push(`    end: ${t.end}`);
      lines.push(`    label: ${yamlString(t.label)}`);
    }
  }
  await writeConfigDoc(themesFile(), lines, doc.body);
}

export async function listThemes(): Promise<Theme[]> {
  const { themes } = await readDoc();
  return themes.sort((a, b) => a.start.localeCompare(b.start));
}

export async function createTheme(input: ThemeInput): Promise<Theme> {
  return enqueueWrite(themesFile(), async () => {
    const doc = await readDoc();
    assertNoOverlap(doc.themes, input);
    const theme: Theme = { id: makeId(input.start), ...input };
    await writeDoc({ ...doc, themes: [...doc.themes, theme] });
    return theme;
  });
}

export class ThemeNotFoundError extends Error {}
export class ThemeOverlapError extends Error {}

/**
 * Deux thèmes ne peuvent pas se chevaucher : une période porte un fil
 * conducteur, pas deux. Le contrôle vit ICI et pas dans la route, parce que
 * c'est le seul endroit sérialisé par `enqueueWrite` — deux créations
 * simultanées passeraient à travers un contrôle fait en amont.
 */
function assertNoOverlap(themes: Theme[], candidate: ThemeInput, exceptId?: string) {
  const clash = themes.find((t) => t.id !== exceptId && overlaps(t, candidate));
  if (clash) {
    throw new ThemeOverlapError(
      `« ${clash.label} » couvre déjà ${clash.start} → ${clash.end}. Modifie-le plutôt que d'en ajouter un second.`,
    );
  }
}

export async function updateTheme(id: string, input: ThemeInput): Promise<Theme> {
  return enqueueWrite(themesFile(), async () => {
    const doc = await readDoc();
    const index = doc.themes.findIndex((t) => t.id === id);
    if (index === -1) throw new ThemeNotFoundError("Thème introuvable");
    assertNoOverlap(doc.themes, input, id);
    const theme: Theme = { ...doc.themes[index], ...input };
    const themes = [...doc.themes];
    themes[index] = theme;
    await writeDoc({ ...doc, themes });
    return theme;
  });
}

export async function deleteTheme(id: string): Promise<void> {
  return enqueueWrite(themesFile(), async () => {
    const doc = await readDoc();
    if (!doc.themes.some((t) => t.id === id)) throw new ThemeNotFoundError("Thème introuvable");
    await writeDoc({ ...doc, themes: doc.themes.filter((t) => t.id !== id) });
  });
}
