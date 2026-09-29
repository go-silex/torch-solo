import { promises as fs } from "node:fs";
import { CORE_SCHEMA, load as yamlLoad } from "js-yaml";
import { getTorchZone } from "@/lib/config";
import { splitFrontmatter } from "@/lib/vault/frontmatter";
import { TargetsSchema, type Format, type Targets } from "@/lib/types/content";
import type { CacheEntry } from "@/lib/vault/store";

/**
 * Waterfall (Content_Strategy_v4) : 1 épisode totem → dérivés attendus.
 * Les objectifs vivent dans le vault (_Config/Targets.md), éditables dans
 * Obsidian ; défauts raisonnables si le fichier manque.
 */

export type Expected = number | [number, number];

export const DEFAULT_TARGETS: Targets = {
  type: "torch-config",
  "weekly-targets": { caroline: { post: 3 } },
  "waterfall-expected": {
    toolkit: 1,
    essay: 1,
    post: [4, 6],
    short: [3, 5],
  },
};

export async function getTargets(): Promise<Targets> {
  const { targetsFile } = getTorchZone();
  try {
    const raw = await fs.readFile(targetsFile, "utf8");
    const split = splitFrontmatter(raw);
    if (!split) return DEFAULT_TARGETS;
    const data = yamlLoad(split.yamlSource, { schema: CORE_SCHEMA });
    const parsed = TargetsSchema.safeParse(data);
    if (!parsed.success) return migrateLegacyTargets(data) ?? DEFAULT_TARGETS;
    return parsed.data;
  } catch {
    return DEFAULT_TARGETS;
  }
}

/** Ancien schéma plat ({ "founders-posts": 3, "youtube-videos": 1 }). */
function migrateLegacyTargets(data: unknown): Targets | null {
  if (typeof data !== "object" || data === null) return null;
  const wt = (data as Record<string, unknown>)["weekly-targets"];
  if (typeof wt !== "object" || wt === null) return null;
  const flat = wt as Record<string, unknown>;
  const posts = typeof flat["founders-posts"] === "number" ? flat["founders-posts"] : 3;
  const episodes = typeof flat["youtube-videos"] === "number" ? flat["youtube-videos"] : 1;
  return {
    ...DEFAULT_TARGETS,
    ...(data as Record<string, unknown>),
    "weekly-targets": {
      caroline: { post: posts },
      ryse: { episode: episodes },
    },
  } as Targets;
}

export type FamilySlot = {
  format: Format;
  expected: Expected;
  children: { id: string; title: string; status: string }[];
  /** true si le compte atteint (au moins) le minimum attendu */
  fulfilled: boolean;
};

export function buildFamily(
  children: CacheEntry[],
  expected: Record<string, Expected>,
): FamilySlot[] {
  const byFormat = new Map<string, CacheEntry[]>();
  for (const c of children) {
    const list = byFormat.get(c.fm.format) ?? [];
    list.push(c);
    byFormat.set(c.fm.format, list);
  }
  const formats = new Set<string>([
    ...Object.keys(expected),
    ...byFormat.keys(),
  ]);
  const slots: FamilySlot[] = [];
  for (const format of formats) {
    const exp = expected[format] ?? 0;
    const kids = byFormat.get(format) ?? [];
    const min = Array.isArray(exp) ? exp[0] : exp;
    slots.push({
      format: format as Format,
      expected: exp,
      children: kids.map((k) => ({
        id: k.fm.id,
        title: k.fm.title,
        status: k.fm.status,
      })),
      fulfilled: kids.length >= min,
    });
  }
  return slots.sort((a, b) => a.format.localeCompare(b.format));
}

/** Dérivés à créer par défaut quand on clique « générer les dérivés ». */
export function derivativesToCreate(
  episodeTitle: string,
  existing: CacheEntry[],
  expected: Record<string, Expected>,
): { format: Format; title: string }[] {
  const out: { format: Format; title: string }[] = [];
  for (const [format, exp] of Object.entries(expected)) {
    const min = Array.isArray(exp) ? exp[0] : exp;
    const current = existing.filter((e) => e.fm.format === format).length;
    for (let i = current; i < min; i++) {
      const n = min > 1 ? ` ${i + 1}` : "";
      out.push({
        format: format as Format,
        title: `${episodeTitle} — ${format}${n}`,
      });
    }
  }
  return out;
}
