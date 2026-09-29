"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import { EmitterBadge } from "@/components/content/badges";
import { PublishedChart } from "@/components/content/published-chart";
import { useContents, type ContentListItem } from "@/lib/hooks/use-contents";
import {
  CATEGORY_LABELS,
  EMITTER_LABELS,
  PERF_FIELDS,
  PERF_LABELS,
  PLATFORM_LABELS,
  type PerfField,
} from "@/lib/labels";
import { EMITTERS, type Emitter, type Platform } from "@/lib/types/content";
import { cn } from "@/lib/utils";

/**
 * Vue Data : saisie rapide des performances des contenus publiés.
 * Une ligne = une fiche, les chiffres sont écrits dans son frontmatter
 * (`metrics.<plateforme>`) à la sortie de chaque case. Entrée descend d'une
 * ligne dans la même colonne, pour remplir une colonne d'affilée.
 */

type Period = "all" | "90" | "30" | "7";

const PERIODS: { value: Period; label: string }[] = [
  { value: "all", label: "Tout" },
  { value: "90", label: "90 jours" },
  { value: "30", label: "30 jours" },
  { value: "7", label: "7 jours" },
];

const PERIOD_CAPTIONS: Record<Period, string> = {
  all: "depuis le début",
  "90": "90 derniers jours",
  "30": "30 derniers jours",
  "7": "7 derniers jours",
};

const nf = new Intl.NumberFormat("fr-FR");

/** Plateforme sous laquelle on range les chiffres : LinkedIn d'abord. */
function metricPlatform(c: ContentListItem): Platform {
  if (c.platforms.includes("linkedin")) return "linkedin";
  return c.platforms[0] ?? "linkedin";
}

function perfOf(c: ContentListItem): Partial<Record<PerfField, number>> {
  const raw = c.metrics[metricPlatform(c)];
  if (typeof raw !== "object" || raw === null) return {};
  const out: Partial<Record<PerfField, number>> = {};
  for (const f of PERF_FIELDS) {
    const v = (raw as Record<string, unknown>)[f];
    if (typeof v === "number") out[f] = v;
  }
  return out;
}

function publishedDate(c: ContentListItem): string {
  return c["published-at"] ?? c.planned ?? c.created;
}

/** (réactions + commentaires + republications) / impressions. */
function engagementRate(p: Partial<Record<PerfField, number>>): number | null {
  if (!p.impressions) return null;
  return ((p.reactions ?? 0) + (p.comments ?? 0) + (p.shares ?? 0)) / p.impressions;
}

function formatRate(rate: number | null): string {
  return rate === null ? "–" : `${(rate * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

async function saveMetric(c: ContentListItem, field: PerfField, value: number | null) {
  const res = await fetch(`/api/contents/${c.id}/metrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metrics: { [metricPlatform(c)]: { [field]: value } } }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(typeof json?.error === "string" ? json.error : "Enregistrement impossible");
  }
}

function MetricCell({
  content,
  field,
  value,
  row,
  col,
  onSaved,
}: {
  content: ContentListItem;
  field: PerfField;
  value: number | undefined;
  row: number;
  col: number;
  onSaved: () => Promise<unknown>;
}) {
  // Brouillon local tant que la case a le focus (ou que l'écriture court) :
  // une revalidation SWR en pleine frappe n'écrase pas ce qu'on tape.
  const [draft, setDraft] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const shown = draft ?? (value === undefined ? "" : String(value));

  async function commit() {
    if (draft === null) return;
    const trimmed = draft.replace(/\s/g, "");
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && (!Number.isFinite(next) || next < 0)) {
      setState("error");
      return;
    }
    if (next === (value ?? null)) {
      setDraft(null);
      setState("idle");
      return;
    }
    setState("saving");
    try {
      await saveMetric(content, field, next);
      await onSaved();
      setDraft(null);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <input
      inputMode="numeric"
      value={shown}
      data-row={row}
      data-col={col}
      aria-label={`${PERF_LABELS[field]} : ${content.title}`}
      onFocus={(e) => {
        setDraft(shown);
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setDraft(null);
          setState("idle");
          e.currentTarget.blur();
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const below = document.querySelector<HTMLInputElement>(
            `input[data-row="${row + (e.shiftKey ? -1 : 1)}"][data-col="${col}"]`,
          );
          if (below) below.focus();
          else e.currentTarget.blur();
        }
      }}
      placeholder="–"
      className={cn(
        "h-8 w-full rounded-md border bg-transparent px-2 text-right font-mono text-[13px] tabular-nums outline-none transition-colors placeholder:text-muted-foreground/40",
        state === "error"
          ? "border-[var(--peach)] bg-[rgba(235,116,87,0.06)]"
          : "border-transparent hover:border-[var(--hairline)] focus:border-[var(--sky)] focus:bg-[var(--paper)]",
        state === "saving" && "text-muted-foreground",
      )}
    />
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--hairline)] bg-[var(--paper)]/85 px-4 py-3">
      <p className="micro-label text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-[1.75rem] leading-none tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function DataPage() {
  const { contents, isLoading, error, mutate } = useContents("status=published");
  const [emitter, setEmitter] = useState<Emitter | null>(null);
  const [period, setPeriod] = useState<Period>("30");
  // Ids figés au clic : une ligne complétée reste affichée (sinon elle
  // disparaîtrait sous le curseur et Entrée sauterait une ligne).
  const [todoIds, setTodoIds] = useState<Set<string> | null>(null);
  const [search, setSearch] = useState("");
  // Figé au montage : la page ne reste pas ouverte des jours.
  const [now] = useState(() => Date.now());

  const emittersPresent = useMemo(
    () => EMITTERS.filter((e) => contents.some((c) => c.emitter === e)),
    [contents],
  );

  const since = useMemo(
    () =>
      period === "all"
        ? null
        : new Date(now - Number(period) * 86400000).toISOString().slice(0, 10),
    [period, now],
  );

  /** Le graphe compare les personnes : il suit la période, pas les autres filtres. */
  const inPeriod = useMemo(
    () => contents.filter((c) => !since || publishedDate(c) >= since),
    [contents, since],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contents
      .filter((c) => !emitter || c.emitter === emitter)
      .filter((c) => !since || publishedDate(c) >= since)
      .filter((c) => !todoIds || todoIds.has(c.id))
      .filter((c) => !q || c.title.toLowerCase().includes(q))
      .sort((a, b) => publishedDate(b).localeCompare(publishedDate(a)));
  }, [contents, emitter, since, todoIds, search]);

  const totals = useMemo(() => {
    let impressions = 0;
    let interactions = 0;
    let filled = 0;
    for (const c of rows) {
      const p = perfOf(c);
      if (p.impressions === undefined) continue;
      filled += 1;
      impressions += p.impressions;
      interactions += (p.reactions ?? 0) + (p.comments ?? 0) + (p.shares ?? 0);
    }
    return {
      impressions,
      rate: impressions ? interactions / impressions : null,
      filled,
    };
  }, [rows]);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-8">
      <div>
        <h1 className="font-display text-[2rem] leading-tight">Data</h1>
        <p className="text-sm text-muted-foreground">
          Performances des contenus publiés. Tape un chiffre, Entrée passe à la ligne
          suivante ; tout est enregistré dans la fiche.
        </p>
      </div>

      <PublishedChart contents={inPeriod} periodLabel={PERIOD_CAPTIONS[period]} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Contenus publiés" value={nf.format(rows.length)} />
        <Kpi
          label="À compléter"
          value={nf.format(rows.length - totals.filled)}
          hint="sans impressions saisies"
        />
        <Kpi label="Impressions" value={nf.format(totals.impressions)} />
        <Kpi
          label="Engagement moyen"
          value={formatRate(totals.rate)}
          hint="réactions + commentaires + republications / impressions"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="h-9 w-56 rounded-lg border border-[var(--hairline)] bg-[var(--paper)] pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-[var(--sky)]"
          />
        </div>
        <Segmented
          options={[
            { value: null, label: "Tous" },
            ...emittersPresent.map((e) => ({ value: e, label: EMITTER_LABELS[e] })),
          ]}
          value={emitter}
          onChange={setEmitter}
        />
        <Segmented options={PERIODS} value={period} onChange={setPeriod} />
        <button
          type="button"
          onClick={() =>
            setTodoIds((ids) =>
              ids
                ? null
                : new Set(
                    contents.filter((c) => perfOf(c).impressions === undefined).map((c) => c.id),
                  ),
            )
          }
          className={cn(
            "flex h-9 items-center rounded-lg border px-3 text-[13px] transition-colors",
            todoIds
              ? "border-[var(--ink)]/30 bg-[var(--ink)] font-medium text-white"
              : "border-[var(--hairline)] bg-[var(--paper)] text-muted-foreground hover:text-foreground",
          )}
        >
          À compléter seulement
        </button>
      </div>

      {error && (
        <p className="text-sm text-[var(--peach)]">Erreur : {String(error.message ?? error)}</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--hairline)] bg-[var(--paper)]/85">
        <table className="w-full text-sm">
          <thead>
            <tr className="micro-label border-b border-[var(--hairline)] text-left text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Publié le</th>
              <th className="px-3 py-3 font-semibold">Contenu</th>
              <th className="px-3 py-3 font-semibold">Plateforme</th>
              {PERF_FIELDS.map((f) => (
                <th key={f} className="w-28 px-2 py-3 text-right font-semibold">
                  {PERF_LABELS[f]}
                </th>
              ))}
              <th className="w-20 px-3 py-3 text-right font-semibold">Clics</th>
              <th className="w-24 px-4 py-3 text-right font-semibold">Engagement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c, rowIndex) => {
              const perf = perfOf(c);
              const clicks = typeof c.metrics.clicks === "number" ? c.metrics.clicks : null;
              return (
                <tr
                  key={c.id}
                  className="border-b border-border/50 transition-colors last:border-0 hover:bg-[var(--haze)]/20"
                >
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-muted-foreground">
                    {publishedDate(c)}
                  </td>
                  <td className="max-w-md px-3 py-2">
                    <div className="flex items-start gap-1.5">
                      <Link
                        href={`/content/${c.id}`}
                        className="line-clamp-2 font-medium hover:underline"
                      >
                        {c.title}
                      </Link>
                      {c.obsidianUrl && (
                        <a
                          href={c.obsidianUrl}
                          title="Ouvrir dans Obsidian"
                          className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-[var(--mist)]/60 hover:text-[var(--silex-secondary)]"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <EmitterBadge emitter={c.emitter} />
                      {c.category && (
                        <span className="text-[11px] text-muted-foreground">
                          {CATEGORY_LABELS[c.category]}
                        </span>
                      )}
                      {c["metrics-updated"] && (
                        <span className="text-[10px] text-muted-foreground/70">
                          relevé le {c["metrics-updated"]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {PLATFORM_LABELS[metricPlatform(c)]}
                  </td>
                  {PERF_FIELDS.map((f, colIndex) => (
                    <td key={f} className="px-2 py-2">
                      <MetricCell
                        content={c}
                        field={f}
                        value={perf[f]}
                        row={rowIndex}
                        col={colIndex}
                        onSaved={() => mutate()}
                      />
                    </td>
                  ))}
                  <td
                    className="px-3 py-2 text-right font-mono text-[13px] tabular-nums text-muted-foreground"
                    title="Clics du shortlink, relevés automatiquement"
                  >
                    {clicks === null ? "–" : nf.format(clicks)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-[13px] tabular-nums">
                    {formatRate(engagementRate(perf))}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-14 text-center text-muted-foreground">
                  {contents.length === 0
                    ? "Aucun contenu publié pour l'instant."
                    : "Aucun contenu ne correspond aux filtres."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Segmented<T extends string | null>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex h-9 items-center rounded-lg border border-[var(--hairline)] bg-[var(--paper)] p-0.5">
      {options.map((o) => (
        <button
          key={o.value ?? "all"}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "h-full rounded-md px-2.5 text-[13px] transition-colors",
            o.value === value
              ? "bg-[var(--ink)] font-medium text-white"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
