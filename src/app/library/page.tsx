"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";
import {
  EditStatusBadge,
  EmitterBadge,
  PillarBadge,
  StatusBadge,
} from "@/components/content/badges";
import {
  EMPTY_FILTERS,
  FilterBar,
  filtersToQuery,
  type Filters,
} from "@/components/content/filter-bar";
import { formatSignature, useContents, type ContentListItem } from "@/lib/hooks/use-contents";
import { ContentPeek } from "@/components/content/content-peek";
import { rememberQueue } from "@/lib/hooks/use-content-queue";
import { cn } from "@/lib/utils";

const SORTS = [
  { key: "created", label: "Créé" },
  { key: "updated", label: "Modifié" },
  { key: "planned", label: "Prévu" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

function sortBy(key: SortKey) {
  return (a: ContentListItem, b: ContentListItem) => {
    if (key === "updated") return (b["updated-at"] ?? "").localeCompare(a["updated-at"] ?? "");
    if (key === "planned") {
      if (a.planned && b.planned) return b.planned.localeCompare(a.planned);
      if (a.planned) return -1;
      if (b.planned) return 1;
    }
    return b.created.localeCompare(a.created);
  };
}
import {
  CATEGORY_LABELS,
  FORMAT_LABELS,
  PLATFORM_LABELS,
} from "@/lib/labels";

export default function LibraryPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const query = useMemo(() => filtersToQuery(filters), [filters]);
  const { contents: raw, quarantine, isLoading, error } = useContents(query);
  const [sort, setSort] = useState<SortKey>("created");
  const contents = useMemo(() => [...raw].sort(sortBy(sort)), [raw, sort]);

  /** Ordre de lecture : le tableau tel qu'il est trié à l'écran. */
  useEffect(
    () => rememberQueue("/library", contents.map((c) => c.id)),
    [contents],
  );
  /** Fiche affichée dans le panneau latéral (null = fermé). */
  const [peekId, setPeekId] = useState<string | null>(null);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-8">
      <div>
        <h1 className="font-display text-[2rem] leading-tight">Bibliothèque</h1>
        <p className="text-sm text-muted-foreground">
          {contents.length} contenu{contents.length > 1 ? "s" : ""} — le vault est
          la source de vérité.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <FilterBar filters={filters} onChange={setFilters} />
        <div className="ml-auto flex h-9 items-center gap-1 rounded-lg border border-[var(--hairline)] bg-[var(--paper)] p-0.5 text-[13px]">
          <span className="px-2 text-xs text-muted-foreground">Trier</span>
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={cn(
                "h-full rounded-md px-2.5 transition-colors",
                s.key === sort
                  ? "bg-[var(--ink)] font-medium text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {quarantine.length > 0 && (
        <div className="rounded-xl border border-[var(--peach)]/30 bg-[var(--peach)]/8 p-4 text-sm">
          <p className="mb-1 flex items-center gap-1.5 font-medium">
            <AlertTriangle className="size-4 text-[var(--peach)]" />
            {quarantine.length} fichier{quarantine.length > 1 ? "s" : ""} en
            quarantaine (frontmatter invalide — à corriger dans Obsidian)
          </p>
          <ul className="list-inside list-disc text-muted-foreground">
            {quarantine.map((q) => (
              <li key={q.absPath}>
                <span className="font-mono text-xs">{q.relPath}</span> — {q.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="text-sm text-[var(--peach)]">Erreur : {String(error.message ?? error)}</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--hairline)] bg-[var(--paper)]/85">
        <table className="w-full text-sm">
          <thead>
            <tr className="micro-label border-b border-[var(--hairline)] text-left text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Titre</th>
              <th className="px-3 py-3 font-semibold">Format</th>
              <th className="px-3 py-3 font-semibold">Writer</th>
              <th className="px-3 py-3 font-semibold">Pilier</th>
              <th className="px-3 py-3 font-semibold">Catégorie</th>
              <th className="px-3 py-3 font-semibold">Plateformes</th>
              <th className="px-3 py-3 font-semibold">Statut</th>
              <th className="px-3 py-3 font-semibold">Montage</th>
              <th className="px-3 py-3 font-semibold">Prévu</th>
              <th className="px-3 py-3 font-semibold">Modifié</th>
            </tr>
          </thead>
          <tbody>
            {contents.map((c) => (
              <tr
                key={c.id}
                onClick={() => setPeekId(c.id)}
                className="cursor-pointer border-b border-border/50 transition-colors last:border-0 hover:bg-[var(--haze)]/25"
              >
                <td className="min-w-72 max-w-96 px-4 py-3">
                  {/* Vrai lien conservé : clic milieu / ⌘-clic ouvrent un onglet. */}
                  <div className="flex items-start gap-1.5">
                    <Link
                      href={`/content/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium hover:underline"
                    >
                      {c.title}
                    </Link>
                    {c.obsidianUrl && (
                      <a
                        href={c.obsidianUrl}
                        title="Ouvrir dans Obsidian"
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-[var(--mist)]/60 hover:text-[var(--silex-secondary)]"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-[13px]">{FORMAT_LABELS[c.format]}</td>
                <td className="px-3 py-3"><EmitterBadge emitter={c.emitter} /></td>
                <td className="px-3 py-3"><PillarBadge pillar={c.pillar} /></td>
                <td className="px-3 py-3 text-[13px] text-muted-foreground">
                  {c.category ? CATEGORY_LABELS[c.category] : "–"}
                </td>
                <td className="px-3 py-3 text-xs text-muted-foreground">
                  {c.platforms.map((p) => PLATFORM_LABELS[p]).join(", ") || "—"}
                </td>
                <td className="px-3 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-3 py-3"><EditStatusBadge status={c["edit-status"]} /></td>
                <td className="px-3 py-3 font-mono text-xs text-muted-foreground">
                  {c.planned ?? "–"}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                  {formatSignature(c) ?? "–"}
                </td>
              </tr>
            ))}
            {contents.length === 0 && !isLoading && (
              <tr>
                <td colSpan={11} className="px-4 py-14 text-center text-muted-foreground">
                  Aucun contenu — crée ta première fiche avec « Nouveau contenu »
                  (en bas de la barre latérale).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ContentPeek id={peekId} onClose={() => setPeekId(null)} />
    </div>
  );
}
