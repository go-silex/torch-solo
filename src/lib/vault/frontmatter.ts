import { CORE_SCHEMA, load as yamlLoad } from "js-yaml";
import {
  CANONICAL_KEY_ORDER,
  ContentFrontmatterSchema,
  type ContentFrontmatter,
} from "@/lib/types/content";

/**
 * Parse / sérialisation du frontmatter Torch.
 *
 * Invariants :
 * - le CORPS de la note n'est JAMAIS re-sérialisé : c'est la tranche brute du
 *   fichier après la ligne de fermeture `---`, restituée octet pour octet ;
 * - la sérialisation du frontmatter est DÉTERMINISTE (ordre de clés canonique,
 *   style plain, dates non quotées) : serialize(parse(serialize(x))) === serialize(x) ;
 * - YAML lu en CORE_SCHEMA : `2026-08-06` reste une chaîne (jamais un objet Date).
 */

export type ParsedContent = {
  fm: ContentFrontmatter;
  body: string;
};

export type ParseFailure = {
  error: string;
};

const OPEN = /^---\r?\n/;

export function splitFrontmatter(
  raw: string,
): { yamlSource: string; body: string } | null {
  const open = raw.match(OPEN);
  if (!open) return null;
  const rest = raw.slice(open[0].length);
  // Ligne de fermeture : `---` seule (fin de fichier ou suivie d'un saut de ligne).
  const close = rest.match(/(^|\r?\n)---[ \t]*(\r?\n|$)/);
  if (!close || close.index === undefined) return null;
  const yamlSource = rest.slice(0, close.index + close[1].length);
  const body = rest.slice(close.index + close[0].length);
  return { yamlSource, body };
}

export function parseContentFile(raw: string): ParsedContent | ParseFailure {
  const split = splitFrontmatter(raw);
  if (!split) return { error: "Frontmatter absent ou non fermé (--- ... ---)" };

  let data: unknown;
  try {
    data = yamlLoad(split.yamlSource, { schema: CORE_SCHEMA }) ?? {};
  } catch (err) {
    return { error: `YAML invalide : ${err instanceof Error ? err.message : String(err)}` };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { error: "Le frontmatter doit être un objet YAML" };
  }

  const result = ContentFrontmatterSchema.safeParse(data);
  if (!result.success) {
    const first = result.error.issues[0];
    return {
      error: `Frontmatter invalide : ${first ? `${first.path.join(".")} — ${first.message}` : "erreur de schéma"}`,
    };
  }
  return { fm: result.data, body: split.body };
}

/* ---------- Sérialisation déterministe ---------- */

const PLAIN_SCALAR = /^[A-Za-z0-9][A-Za-z0-9_./:@-]*$/;
const AMBIGUOUS = new Set([
  "true",
  "false",
  "null",
  "yes",
  "no",
  "on",
  "off",
  "~",
]);

function emitScalar(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "null";
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  const s = String(value);
  if (s === "") return '""';
  if (PLAIN_SCALAR.test(s) && !AMBIGUOUS.has(s.toLowerCase()) && !/^[+-]?\d+(\.\d+)?$/.test(s)) {
    return s;
  }
  // Dates YYYY-MM-DD : plain (le CORE_SCHEMA ne les convertit pas).
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return JSON.stringify(s);
}

function emitValue(value: unknown, indent: number): string {
  const pad = "  ".repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    if (value.every((v) => typeof v !== "object" || v === null)) {
      return `[${value.map((v) => emitScalar(v)).join(", ")}]`;
    }
    return value
      .map((v) => `\n${pad}- ${emitValue(v, indent + 1).trimStart()}`)
      .join("");
  }

  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return entries
      .map(([k, v]) => {
        const rendered = emitValue(v, indent + 1);
        const key = PLAIN_SCALAR.test(k) ? k : JSON.stringify(k);
        return rendered.startsWith("\n")
          ? `\n${pad}${key}:${rendered}`
          : `\n${pad}${key}: ${rendered}`;
      })
      .join("");
  }

  return emitScalar(value);
}

export function serializeFrontmatter(fm: ContentFrontmatter): string {
  const record = fm as Record<string, unknown>;
  const known = CANONICAL_KEY_ORDER.filter((k) => k in record);
  const unknown = Object.keys(record)
    .filter((k) => !CANONICAL_KEY_ORDER.includes(k))
    .sort();

  const lines: string[] = ["---"];
  for (const key of [...known, ...unknown]) {
    const rendered = emitValue(record[key], 1);
    lines.push(rendered.startsWith("\n") ? `${key}:${rendered}` : `${key}: ${rendered}`);
  }
  lines.push("---");
  return lines.join("\n") + "\n";
}

export function serializeContentFile(fm: ContentFrontmatter, body: string): string {
  return serializeFrontmatter(fm) + body;
}
