import type {
  Category,
  EditStatus,
  Emitter,
  Format,
  Goal,
  Pillar,
  Platform,
  Sel,
  Status,
} from "@/lib/types/content";

/** Labels FR pour l'UI. Les valeurs machine restent en anglais (frontmatter). */

export const FORMAT_LABELS: Record<Format, string> = {
  episode: "Épisode",
  toolkit: "Toolkit",
  essay: "Essai long",
  newsletter: "Newsletter",
  post: "Post",
  short: "Short",
  event: "Événement",
  adhoc: "Ad hoc",
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  linkedin: "LinkedIn",
  youtube: "YouTube",
  reels: "Reels",
  newsletter: "Newsletter",
  podcast: "Podcast",
  blog: "Blog",
  twitter: "Twitter",
};

export const CATEGORY_LABELS: Record<Category, string> = {
  "cas-business": "Business case",
  interview: "Interview",
  "behind-the-scenes": "Behind the scenes",
  "tuto-ia": "Tutoriel",
  // « Thought leadership » est un pilier : la catégorie garde son propre nom.
  opinion: "Prise de position",
};

export const GOAL_LABELS: Record<Goal, string> = {
  "podcast-traffic": "Écoutes podcast",
  leads: "Leads",
  branding: "Branding",
};

/**
 * Performances saisies à la main (vue Data + fiche), rangées sous
 * `metrics.<plateforme>`. Mêmes clés que la vue Data.
 */
export const PERF_FIELDS = ["impressions", "reactions", "comments", "shares"] as const;
export type PerfField = (typeof PERF_FIELDS)[number];

export const PERF_LABELS: Record<PerfField, string> = {
  impressions: "Impressions",
  reactions: "Réactions",
  comments: "Commentaires",
  shares: "Republications",
};

export const PILLAR_LABELS: Record<Pillar, string> = {
  "thought-leadership": "Thought Leadership",
  builders: "Builders",
  methode: "Méthode",
  none: "Hors pilier",
};

export const SEL_LABELS: Record<Sel, string> = {
  story: "Story",
  educate: "Educate",
  list: "List",
};

export const EMITTER_LABELS: Record<Emitter, string> = {
  caroline: "Caroline",
  ryse: "@Ryse",
};

export const STATUS_LABELS: Record<Status, string> = {
  idea: "Idée",
  draft: "Brouillon",
  "to-shoot": "À tourner",
  shot: "Tourné",
  "to-edit": "À monter",
  edited: "Monté",
  ready: "Prêt",
  scheduled: "Planifié",
  published: "Publié",
  archived: "Archivé",
};

export const EDIT_STATUS_LABELS: Record<EditStatus, string> = {
  none: "—",
  editing: "Au montage",
  "in-review": "À valider",
  "changes-requested": "Modifs demandées",
  approved: "Approuvé",
};

/* ---------- Système de couleurs — 100 % palette Silex Halo ----------
   paper #FEFEFE · mist #DCE7F2 · sky #6B9FD4 · secondary #2e5f9d
   peach #EB7457 · bronze #B8976E · ink #031635
   Chips : fond = teinte d'accent (10-16 %), texte = ink, dot = accent. */

/** Couleur d'accent par émetteur — dot des cartes, chips, liserés. */
export const EMITTER_ACCENTS: Record<Emitter, string> = {
  caroline: "#2e5f9d", // secondary
  ryse: "#eb7457", // peach
};

export const EMITTER_CHIP: Record<Emitter, string> = {
  caroline: "bg-[rgba(46,95,157,0.13)] text-[var(--ink)]",
  ryse: "bg-[rgba(235,116,87,0.13)] text-[var(--ink)]",
};

/** Couleur d'accent par statut : liseré des cartes (calendrier, kanban) + légende. */
export const STATUS_ACCENTS: Record<Status, string> = {
  idea: "#8d9bad", // gris ardoise
  draft: "#eb7457", // peach
  // Production : une seule famille (bronze), de plus en plus soutenue.
  "to-shoot": "#d9bc8f",
  shot: "#b8976e",
  "to-edit": "#9a7c52",
  edited: "#7a6140",
  ready: "#6b9fd4", // sky
  scheduled: "#2e5f9d", // secondary
  published: "#2f9a68", // vert (seule teinte hors palette, pour la lisibilité)
  archived: "#c9d1dc",
};

/** Fond des cartes du calendrier : teinte franche du statut (lisible d'un coup d'œil). */
export const STATUS_TINTS: Record<Status, string> = {
  idea: "rgba(141,155,173,0.22)",
  draft: "rgba(235,116,87,0.26)",
  "to-shoot": "rgba(217,188,143,0.30)",
  shot: "rgba(184,151,110,0.34)",
  "to-edit": "rgba(154,124,82,0.30)",
  edited: "rgba(122,97,64,0.34)",
  ready: "rgba(107,159,212,0.40)",
  scheduled: "rgba(46,95,157,0.32)",
  published: "#2f9a68", // plein, texte paper (voir STATUS_TINT_TEXT)
  archived: "rgba(201,209,220,0.4)",
};

/** Couleur de texte sur STATUS_TINTS. */
export const STATUS_TINT_TEXT: Record<Status, string> = {
  idea: "#031635",
  draft: "#031635",
  "to-shoot": "#031635",
  shot: "#031635",
  "to-edit": "#031635",
  edited: "#031635",
  ready: "#031635",
  scheduled: "#031635",
  published: "#fefefe",
  archived: "#031635",
};

export const STATUS_CHIP: Record<Status, string> = {
  idea: "bg-[var(--mist)]/60 text-[var(--ink)]/70",
  draft: "bg-[rgba(235,116,87,0.18)] text-[var(--ink)]",
  "to-shoot": "bg-[rgba(217,188,143,0.30)] text-[var(--ink)]",
  shot: "bg-[rgba(184,151,110,0.30)] text-[var(--ink)]",
  "to-edit": "bg-[rgba(154,124,82,0.24)] text-[var(--ink)]",
  edited: "bg-[rgba(122,97,64,0.24)] text-[var(--ink)]",
  ready: "bg-[rgba(107,159,212,0.28)] text-[var(--ink)]",
  scheduled: "bg-[rgba(46,95,157,0.22)] text-[var(--ink)]",
  published: "bg-[#2f9a68] text-[var(--paper)]",
  archived: "bg-[var(--paper-deep)] text-[var(--ink)]/40",
};

export const STATUS_DOTS: Record<Status, string> = {
  idea: "bg-[#8d9bad]",
  draft: "bg-[var(--peach)]",
  "to-shoot": "bg-[#d9bc8f]",
  shot: "bg-[#b8976e]",
  "to-edit": "bg-[#9a7c52]",
  edited: "bg-[#7a6140]",
  ready: "bg-[var(--sky)]",
  scheduled: "bg-[var(--silex-secondary)]",
  published: "bg-[#2f9a68]",
  archived: "bg-[var(--ink)]/25",
};

export const EDIT_STATUS_CHIP: Record<EditStatus, string> = {
  none: "hidden",
  editing: "bg-[var(--mist)]/60 text-[var(--ink)]/80",
  "in-review": "bg-[rgba(107,159,212,0.2)] text-[var(--ink)]",
  "changes-requested": "bg-[rgba(235,116,87,0.16)] text-[var(--ink)]",
  approved: "bg-[rgba(46,95,157,0.15)] text-[var(--silex-secondary)]",
};

export const PILLAR_CHIP: Record<Pillar, string> = {
  "thought-leadership": "bg-[rgba(107,159,212,0.16)] text-[var(--ink)]",
  builders: "bg-[rgba(235,116,87,0.13)] text-[var(--ink)]",
  methode: "bg-[rgba(46,95,157,0.13)] text-[var(--ink)]",
  none: "bg-transparent text-[var(--ink)]/40 ring-1 ring-inset ring-[var(--hairline)]",
};

/**
 * Thèmes de la semaine : cinq teintes qui tournent, pour qu'on distingue une
 * semaine de la suivante d'un coup d'œil. La couleur se déduit du numéro de
 * semaine (voir `weekIndex`) — rien à choisir, rien à stocker.
 */
export const THEME_HUES = ["#3e7bc4", "#2f9a68", "#c98a2e", "#8e5fa8", "#2f8f9a"] as const;

export function themeHue(weekIndex: number): string {
  return THEME_HUES[((weekIndex % THEME_HUES.length) + THEME_HUES.length) % THEME_HUES.length];
}

/** Teinte de fond d'un bandeau de thème (convention chip : fond léger, texte ink). */
export function themeTint(hue: string, hover = false): string {
  const n = parseInt(hue.slice(1), 16);
  const rgb = `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  return `rgba(${rgb}, ${hover ? 0.2 : 0.12})`;
}
