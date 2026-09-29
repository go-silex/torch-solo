import { z } from "zod";

/**
 * Modèle canonique d'une fiche contenu Torch.
 * Taxonomie héritée du Torch d'Unkillable Companies (piliers, catégories, objectifs).
 */

export const FORMATS = [
  "episode",
  "toolkit",
  "essay",
  "newsletter",
  "post",
  "short",
  "event",
  "adhoc",
] as const;
export type Format = (typeof FORMATS)[number];

/** Alignées sur le Google Sheet « Content Calendar » (colonne Plateform). */
export const PLATFORMS = [
  "linkedin",
  "youtube",
  "reels",
  "newsletter",
  "podcast",
  "blog",
  "twitter",
] as const;
export type Platform = (typeof PLATFORMS)[number];

/**
 * Anciennes valeurs encore présentes dans des notes écrites avant l'alignement
 * sur le Sheet : converties à la lecture plutôt que mises en quarantaine.
 * `null` = plateforme abandonnée, retirée de la liste.
 */
const LEGACY_PLATFORMS: Record<string, Platform | null> = {
  instagram: "reels",
  tiktok: "reels",
  "youtube-shorts": "reels",
  site: "blog",
  x: "twitter",
};

function migratePlatforms(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const out: unknown[] = [];
  for (const v of value) {
    const next = typeof v === "string" && v in LEGACY_PLATFORMS ? LEGACY_PLATFORMS[v] : v;
    if (next !== null && !out.includes(next)) out.push(next);
  }
  return out;
}

/**
 * Même principe que `migratePlatforms`, pour une valeur simple : une valeur
 * renommée est convertie À LA LECTURE. Sans cela, renommer une valeur d'enum
 * mettrait en quarantaine toutes les notes qui la portent — et une note en
 * quarantaine ne peut plus être réparée depuis Torch.
 */
function migrateScalar<T extends string>(legacy: Record<string, T>) {
  return (value: unknown): unknown =>
    typeof value === "string" && value in legacy ? legacy[value] : value;
}

/** Colonne Category du Sheet : un seul choix. */
export const CATEGORIES = [
  "cas-business",
  "interview",
  "behind-the-scenes",
  "tuto-ia",
  "opinion",
] as const;
export type Category = (typeof CATEGORIES)[number];

/** `coulisses-bootcamp` faisait doublon avec les coulisses (aucune fiche ne le portait). */
const migrateCategory = migrateScalar<Category>({
  "coulisses-bootcamp": "behind-the-scenes",
});

/** Colonne Goal du Sheet : plusieurs choix possibles. */
export const GOALS = ["podcast-traffic", "leads", "branding"] as const;
export type Goal = (typeof GOALS)[number];

export const PILLARS = [
  "thought-leadership",
  "builders",
  "methode",
  "none",
] as const;
export type Pillar = (typeof PILLARS)[number];

/** Noms d'avant le 2026-09-22 — mêmes territoires, libellés plus clairs. */
const migratePillar = migrateScalar<Pillar>({
  "futur-du-travail": "thought-leadership",
  "le-chantier": "builders",
  "blueprint-ai-native": "methode",
});

/**
 * Story / Educate / List — grille d'idéation retirée de l'interface le
 * 2026-09-22 (la catégorie joue ce rôle, en plus concret). La clé reste
 * acceptée et préservée dans les 149 fiches qui la portent.
 */
export const SELS = ["story", "educate", "list"] as const;
export type Sel = (typeof SELS)[number];

export const EMITTERS = ["caroline", "ryse"] as const;
export type Emitter = (typeof EMITTERS)[number];

/**
 * Pipeline éditorial complet. Les quatre étapes de production (tournage,
 * montage) s'intercalent entre le brouillon et « prêt » : elles ne concernent
 * que la vidéo, et les colonnes correspondantes du kanban sont masquées par
 * défaut. Elles ne peuvent pas vivre dans `edit-status`, que le poller Flame
 * réécrit toutes les 5 minutes.
 */
export const STATUSES = [
  "idea",
  "draft",
  "to-shoot",
  "shot",
  "to-edit",
  "edited",
  "ready",
  "scheduled",
  "published",
  "archived",
] as const;
export type Status = (typeof STATUSES)[number];

export const EDIT_STATUSES = [
  "none",
  "editing",
  "in-review",
  "changes-requested",
  "approved",
] as const;
export type EditStatus = (typeof EDIT_STATUSES)[number];

/** Noms de dossiers vault par émetteur et par format. */
export const EMITTER_DIRS: Record<Emitter, string> = {
  caroline: "Caroline",
  ryse: "Ryse",
};

export const FORMAT_DIRS: Record<Format, string> = {
  episode: "Episodes",
  toolkit: "Toolkits",
  essay: "Essays",
  newsletter: "Newsletters",
  post: "Posts",
  short: "Shorts",
  event: "Events",
  adhoc: "Adhoc",
};

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format YYYY-MM-DD");

/** Métriques par plateforme : clés connues typées, extras tolérés (Apify plus tard). */
const platformMetrics = z
  .object({
    views: z.number().optional(),
    impressions: z.number().optional(),
    likes: z.number().optional(),
    reactions: z.number().optional(),
    comments: z.number().optional(),
    shares: z.number().optional(),
    saves: z.number().optional(),
  })
  .catchall(z.union([z.number(), z.string(), z.null()]));

const metricsSchema = z
  .object({ clicks: z.number().optional() })
  .catchall(z.union([platformMetrics, z.number(), z.null()]));

/**
 * Champs modifiables, SANS défauts.
 * ⚠️ Les défauts ne doivent JAMAIS apparaître dans le schéma de PATCH : Zod
 * les ré-injecterait pour chaque clé absente et chaque PATCH écraserait alors
 * tous les autres champs (bug historique — voir test « ne contient que les
 * clés fournies »).
 */
const MUTABLE_FIELDS = {
  title: z.string().min(1),
  format: z.enum(FORMATS),
  platforms: z.preprocess(migratePlatforms, z.array(z.enum(PLATFORMS))),
  pillar: z.preprocess(migratePillar, z.enum(PILLARS)),
  category: z.preprocess(migrateCategory, z.enum(CATEGORIES).nullable()),
  goals: z.array(z.enum(GOALS)),
  sel: z.enum(SELS),
  emitter: z.enum(EMITTERS),
  status: z.enum(STATUSES),
  "edit-status": z.enum(EDIT_STATUSES),
  editor: z.string().nullable(),
  planned: isoDate.nullable(),
  "published-at": isoDate.nullable(),
  "derived-from": z.string().nullable(),
  recycles: z.string().nullable(),
  "published-urls": z.record(z.string(), z.string().nullable()),
  "flame-project": z.string().nullable(),
  "flame-folder": z.string().nullable(),
  "flame-review-url": z.string().nullable(),
  "shortlink-slug": z.string().nullable(),
  shortlink: z.string().nullable(),
  /**
   * Chemin du PNG relatif à la racine du Drive `silex-assets`
   * (ex. "Torch_Vignettes/2026-08-07_Titre.png"). Hors du vault : les binaires
   * n'ont rien à faire dans silex-hub (Obsidian, miroir Linux, mount VPS).
   */
  thumbnail: z.string().nullable(),
  /** Id de l'asset dans l'archive Rocky (Rocky_Assets) — traçabilité. */
  "thumbnail-asset": z.string().nullable(),
  metrics: metricsSchema,
  "metrics-updated": isoDate.nullable(),
  tags: z.array(z.string()),
  /** Prénom de la personne (machine) qui a écrit la fiche en dernier, via Torch. */
  "updated-by": z.string().nullable(),
  /** Horodatage ISO de la dernière écriture Torch (Obsidian n'y touche pas). */
  "updated-at": z.string().nullable(),
};

export const ContentFrontmatterSchema = z
  .object({
    type: z.literal("torch-content"),
    schema: z.number().default(1),
    id: z.string().min(1),
    created: isoDate,

    title: MUTABLE_FIELDS.title,
    format: MUTABLE_FIELDS.format,
    emitter: MUTABLE_FIELDS.emitter,
    // Facultatif depuis le 2026-09-22 : plus demandé à la création, conservé
    // dans les fiches qui l'ont déjà.
    sel: MUTABLE_FIELDS.sel.optional(),

    platforms: MUTABLE_FIELDS.platforms.default([]),
    pillar: MUTABLE_FIELDS.pillar.default("none"),
    category: MUTABLE_FIELDS.category.default(null),
    goals: MUTABLE_FIELDS.goals.default([]),
    status: MUTABLE_FIELDS.status.default("idea"),
    "edit-status": MUTABLE_FIELDS["edit-status"].default("none"),
    editor: MUTABLE_FIELDS.editor.default(null),
    planned: MUTABLE_FIELDS.planned.default(null),
    "published-at": MUTABLE_FIELDS["published-at"].default(null),
    "derived-from": MUTABLE_FIELDS["derived-from"].default(null),
    recycles: MUTABLE_FIELDS.recycles.default(null),
    "published-urls": MUTABLE_FIELDS["published-urls"].default({}),
    "flame-project": MUTABLE_FIELDS["flame-project"].default(null),
    "flame-folder": MUTABLE_FIELDS["flame-folder"].default(null),
    "flame-review-url": MUTABLE_FIELDS["flame-review-url"].default(null),
    "shortlink-slug": MUTABLE_FIELDS["shortlink-slug"].default(null),
    shortlink: MUTABLE_FIELDS.shortlink.default(null),
    thumbnail: MUTABLE_FIELDS.thumbnail.default(null),
    "thumbnail-asset": MUTABLE_FIELDS["thumbnail-asset"].default(null),
    metrics: MUTABLE_FIELDS.metrics.default({}),
    "metrics-updated": MUTABLE_FIELDS["metrics-updated"].default(null),
    tags: MUTABLE_FIELDS.tags.default([]),
    "updated-by": MUTABLE_FIELDS["updated-by"].default(null),
    "updated-at": MUTABLE_FIELDS["updated-at"].default(null),
  })
  .loose();

export type ContentFrontmatter = z.infer<typeof ContentFrontmatterSchema>;

/** Champs interdits en PATCH (identité immuable). */
export const IMMUTABLE_KEYS = ["type", "schema", "id", "created"] as const;

/** Un PATCH ne contient QUE les clés fournies par le client — aucun défaut. */
export const ContentPatchSchema = z.object(MUTABLE_FIELDS).partial().loose();
export type ContentPatch = z.infer<typeof ContentPatchSchema>;

export type ContentFilter = {
  status?: Status[];
  format?: Format[];
  pillar?: Pillar[];
  category?: Category[];
  goal?: Goal[];
  sel?: Sel[];
  emitter?: Emitter[];
  platform?: Platform[];
  derivedFrom?: string;
  search?: string;
};

/** Ordre canonique des clés à la sérialisation (les inconnues vont à la fin, triées). */
export const CANONICAL_KEY_ORDER: string[] = [
  "type",
  "schema",
  "id",
  "title",
  "format",
  "platforms",
  "pillar",
  "category",
  "goals",
  "sel",
  "emitter",
  "status",
  "edit-status",
  "editor",
  "created",
  "planned",
  "published-at",
  "derived-from",
  "recycles",
  "published-urls",
  "flame-project",
  "flame-folder",
  "flame-review-url",
  "shortlink-slug",
  "shortlink",
  "thumbnail",
  "thumbnail-asset",
  "metrics",
  "metrics-updated",
  "tags",
  "updated-by",
  "updated-at",
];

/** Config cadence (Targets.md). */
export const TargetsSchema = z
  .object({
    type: z.literal("torch-config"),
    // émetteur → format → nombre par semaine (ex: caroline: { post: 3 })
    "weekly-targets": z
      .record(z.string(), z.record(z.string(), z.number()))
      .default({ caroline: { post: 3 } }),
    "waterfall-expected": z
      .record(z.string(), z.union([z.number(), z.tuple([z.number(), z.number()])]))
      .default({}),
  })
  .loose();
export type Targets = z.infer<typeof TargetsSchema>;
