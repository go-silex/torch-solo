import { promises as fs } from "node:fs";
import path from "node:path";
import { CORE_SCHEMA, load as yamlLoad } from "js-yaml";
import { getOperatorName } from "@/lib/config";
import { splitFrontmatter } from "@/lib/vault/frontmatter";

/**
 * Fichiers de réglages du vault (`_Config/*.md` : Targets, Themes, Rules).
 *
 * Ce ne sont pas des fiches : ils vivent hors du dossier `Content/`, donc hors
 * du cache et hors du watcher. Y écrire ne peut pas abîmer un contenu. Ils
 * restent lisibles et éditables à la main dans Obsidian, et leur corps
 * markdown est préservé à la réécriture.
 */

export type ConfigDoc = { data: Record<string, unknown>; body: string };

/** Frontmatter et corps du fichier. Illisible ou absent → réglages vides. */
export async function readConfigDoc(file: string, defaultBody: string): Promise<ConfigDoc> {
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    return { data: {}, body: defaultBody };
  }
  const split = splitFrontmatter(raw);
  if (!split) return { data: {}, body: raw.trim() ? raw : defaultBody };

  let parsed: unknown;
  try {
    parsed = yamlLoad(split.yamlSource, { schema: CORE_SCHEMA }) ?? {};
  } catch {
    // YAML cassé : on n'écrase rien, on repart de réglages vides en mémoire.
    return { data: {}, body: split.body || defaultBody };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { data: {}, body: split.body || defaultBody };
  }
  return { data: parsed as Record<string, unknown>, body: split.body || defaultBody };
}

/** Scalaire YAML toujours sûr : « Thème : la semaine » reste relisible. */
export function yamlString(value: string): string {
  return JSON.stringify(value);
}

/**
 * Réécrit le fichier : `yamlLines` (sans les `---`), la signature de
 * l'opérateur, puis le corps inchangé. Écriture atomique (tmp + rename).
 */
export async function writeConfigDoc(
  file: string,
  yamlLines: string[],
  body: string,
): Promise<void> {
  const operator = getOperatorName();
  const lines = ["---", "type: torch-config", ...yamlLines];
  if (operator) lines.push(`updated-by: ${yamlString(operator)}`);
  lines.push(`updated-at: ${new Date().toISOString().slice(0, 19)}`);
  lines.push("---");

  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.tmp`);
  await fs.writeFile(tmp, lines.join("\n") + "\n" + body, "utf8");
  await fs.rename(tmp, file);
}

/** Une écriture à la fois par fichier : pas de lire-modifier-écrire entrelacé. */
const queues = new Map<string, Promise<unknown>>();
export function enqueueWrite<T>(file: string, job: () => Promise<T>): Promise<T> {
  const previous = queues.get(file) ?? Promise.resolve();
  const run = previous.then(job, job);
  queues.set(
    file,
    run.catch(() => undefined),
  );
  return run;
}
