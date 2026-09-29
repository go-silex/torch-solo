"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABELS,
  FORMAT_LABELS,
  GOAL_LABELS,
  PILLAR_LABELS,
  PLATFORM_LABELS,
  STATUS_LABELS,
} from "@/lib/labels";
import {
  CATEGORIES,
  FORMATS,
  GOALS,
  PILLARS,
  PLATFORMS,
  STATUSES,
  type Category,
  type Emitter,
  type Format,
  type Goal,
  type Pillar,
  type Platform,
  type Status,
} from "@/lib/types/content";

export type Filters = {
  status: Status[];
  format: Format[];
  pillar: Pillar[];
  category: Category[];
  goal: Goal[];
  platform: Platform[];
  /** Plus de menu : le groupe de boutons « Writer » est le seul à le poser. */
  emitter: Emitter[];
  search: string;
};

export const EMPTY_FILTERS: Filters = {
  status: [],
  format: [],
  pillar: [],
  category: [],
  goal: [],
  platform: [],
  emitter: [],
  search: "",
};

export function filtersToQuery(f: Filters): string {
  const params = new URLSearchParams();
  if (f.status.length) params.set("status", f.status.join(","));
  if (f.format.length) params.set("format", f.format.join(","));
  if (f.pillar.length) params.set("pillar", f.pillar.join(","));
  if (f.category.length) params.set("category", f.category.join(","));
  if (f.goal.length) params.set("goal", f.goal.join(","));
  if (f.platform.length) params.set("platform", f.platform.join(","));
  if (f.emitter.length) params.set("emitter", f.emitter.join(","));
  if (f.search) params.set("search", f.search);
  return params.toString();
}

function FilterMenu<T extends string>({
  label,
  values,
  labels,
  selected,
  onChange,
}: {
  label: string;
  values: readonly T[];
  labels: Record<T, string>;
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const active = selected.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-lg border bg-[var(--paper)] px-3 text-[13px] transition-colors",
          active
            ? "border-[var(--ink)]/30 font-medium text-foreground"
            : "border-[var(--hairline)] text-muted-foreground hover:border-[var(--sky-soft)] hover:text-foreground",
        )}
      >
        {label}
        {active && (
          <span className="flex size-[18px] items-center justify-center rounded-full bg-[var(--ink)] text-[10px] font-semibold text-white">
            {selected.length}
          </span>
        )}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-40 min-w-44 rounded-xl border border-[var(--hairline)] bg-[var(--paper)] p-1 shadow-[0_12px_36px_rgba(3,22,53,0.10)]">
          {values.map((v) => {
            const checked = selected.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() =>
                  onChange(
                    checked ? selected.filter((s) => s !== v) : [...selected, v],
                  )
                }
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-accent"
              >
                {labels[v]}
                {checked && <Check className="size-3.5 text-[var(--sky)]" />}
              </button>
            );
          })}
          {active && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 flex w-full items-center gap-1.5 rounded-lg border-t border-border px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent"
            >
              <X className="size-3" /> Effacer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function FilterBar({
  filters,
  onChange,
  showStatus = true,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  showStatus?: boolean;
}) {
  const hasAny =
    filters.search ||
    filters.platform.length ||
    filters.pillar.length ||
    filters.category.length ||
    filters.goal.length ||
    filters.format.length ||
    (showStatus && filters.status.length);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Rechercher…"
          className="h-9 w-56 rounded-lg border border-[var(--hairline)] bg-[var(--paper)] pl-9 pr-3 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-[var(--sky)]"
        />
      </div>
      <FilterMenu
        label="Plateforme"
        values={PLATFORMS}
        labels={PLATFORM_LABELS}
        selected={filters.platform}
        onChange={(platform) => onChange({ ...filters, platform })}
      />
      <FilterMenu
        label="Pilier"
        values={PILLARS}
        labels={PILLAR_LABELS}
        selected={filters.pillar}
        onChange={(pillar) => onChange({ ...filters, pillar })}
      />
      <FilterMenu
        label="Catégorie"
        values={CATEGORIES}
        labels={CATEGORY_LABELS}
        selected={filters.category}
        onChange={(category) => onChange({ ...filters, category })}
      />
      <FilterMenu
        label="Objectif"
        values={GOALS}
        labels={GOAL_LABELS}
        selected={filters.goal}
        onChange={(goal) => onChange({ ...filters, goal })}
      />
      <FilterMenu
        label="Format"
        values={FORMATS}
        labels={FORMAT_LABELS}
        selected={filters.format}
        onChange={(format) => onChange({ ...filters, format })}
      />
      {showStatus && (
        <FilterMenu
          label="Statut"
          values={STATUSES}
          labels={STATUS_LABELS}
          selected={filters.status}
          onChange={(status) => onChange({ ...filters, status })}
        />
      )}
      {hasAny ? (
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          className="flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" /> Réinitialiser
        </button>
      ) : null}
    </div>
  );
}
