"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Check, Columns3, X } from "lucide-react";
import { ContentCard } from "@/components/content/content-card";
import { ContentPeek } from "@/components/content/content-peek";
import { EmitterViewGroup, useEmitterView } from "@/components/content/view-tabs";
import {
  EMPTY_FILTERS,
  FilterBar,
  filtersToQuery,
  type Filters,
} from "@/components/content/filter-bar";
import { useContents, patchContent } from "@/lib/hooks/use-contents";
import { useHiddenColumns } from "@/lib/hooks/use-hidden-columns";
import { rememberQueue } from "@/lib/hooks/use-content-queue";
import { STATUS_DOTS, STATUS_LABELS } from "@/lib/labels";
import { STATUSES, type Status } from "@/lib/types/content";
import { cn } from "@/lib/utils";
import { byPlanned } from "@/lib/dates";

function Column({
  status,
  children,
  count,
}: {
  status: Status;
  children: React.ReactNode;
  count: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${status}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[70vh] w-[17rem] shrink-0 flex-col gap-2 rounded-xl border border-[var(--hairline-soft)] bg-[var(--paper-deep)]/45 p-2.5 transition-colors",
        isOver && "border-[var(--sky)] bg-[var(--mist)]/50",
      )}
    >
      <div className="flex items-center gap-2 px-1.5 py-1">
        <span className={cn("size-2 rounded-full", STATUS_DOTS[status])} />
        <h2 className="text-[12px] font-semibold text-foreground/80">
          {STATUS_LABELS[status]}
        </h2>
        <span className="ml-auto rounded-full border border-[var(--hairline-soft)] bg-[var(--paper)] px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

/** Choix des colonnes visibles. Même allure que les menus de la barre de filtres. */
function ColumnsMenu({
  hidden,
  onToggle,
  onShowAll,
}: {
  hidden: Set<Status>;
  onToggle: (status: Status) => void;
  onShowAll: () => void;
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-lg border bg-[var(--paper)] px-3 text-[13px] transition-colors",
          hidden.size > 0
            ? "border-[var(--ink)]/30 font-medium text-foreground"
            : "border-[var(--hairline)] text-muted-foreground hover:border-[var(--sky-soft)] hover:text-foreground",
        )}
      >
        <Columns3 className="size-3.5" />
        Colonnes
        {hidden.size > 0 && (
          <span className="flex size-[18px] items-center justify-center rounded-full bg-[var(--ink)] text-[10px] font-semibold text-white">
            {STATUSES.length - hidden.size}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-40 min-w-48 rounded-xl border border-[var(--hairline)] bg-[var(--paper)] p-1 shadow-[0_12px_36px_rgba(3,22,53,0.10)]">
          {STATUSES.map((s) => {
            const shown = !hidden.has(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => onToggle(s)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-accent"
              >
                <span className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", STATUS_DOTS[s])} />
                  {STATUS_LABELS[s]}
                </span>
                {shown && <Check className="size-3.5 text-[var(--sky)]" />}
              </button>
            );
          })}
          {hidden.size > 0 && (
            <button
              type="button"
              onClick={onShowAll}
              className="mt-1 flex w-full items-center gap-1.5 rounded-lg border-t border-border px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent"
            >
              <X className="size-3" /> Tout afficher
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function KanbanPage() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const { activeView, effectiveFilters } = useEmitterView(filters, setFilters);
  const query = useMemo(
    () => filtersToQuery({ ...effectiveFilters, status: [] }),
    [effectiveFilters],
  );
  /** Fiche affichée dans le panneau latéral (null = fermé). */
  const [peekId, setPeekId] = useState<string | null>(null);
  const { contents, mutate } = useContents(query);
  const [error, setError] = useState<string | null>(null);
  const { hidden, toggle, showAll } = useHiddenColumns();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  /** Colonne Publié limitée aux 14 derniers jours (le reste vit dans Data). */
  const [showAllPublished, setShowAllPublished] = useState(false);
  /** 10 cartes par colonne, « voir plus » déplie la colonne. */
  const COLUMN_CAP = 10;
  const [expanded, setExpanded] = useState<Set<Status>>(() => new Set());
  // Figé au montage : la page ne reste pas ouverte des jours.
  const [cutoff] = useState(() => new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10));
  const { byStatus, olderPublished } = useMemo(() => {
    const map = new Map<Status, typeof contents>();
    for (const s of STATUSES) map.set(s, []);
    let older = 0;
    for (const c of contents) {
      if (c.status === "published" && !showAllPublished && (c["published-at"] ?? "") < cutoff) {
        older += 1;
        continue;
      }
      map.get(c.status)?.push(c);
    }
    for (const [s, list] of map) {
      if (s === "published") {
        list.sort((a, b) => (b["published-at"] ?? "").localeCompare(a["published-at"] ?? ""));
      } else {
        list.sort(byPlanned);
      }
    }
    return { byStatus: map, olderPublished: older };
  }, [contents, showAllPublished, cutoff]);

  /** Ordre de lecture : les colonnes visibles, de gauche à droite. */
  const queue = useMemo(() => {
    const ids: string[] = [];
    for (const status of STATUSES) {
      if (hidden.has(status)) continue;
      for (const c of byStatus.get(status) ?? []) ids.push(c.id);
    }
    return ids;
  }, [byStatus, hidden]);

  useEffect(() => rememberQueue("/kanban", queue), [queue]);

  async function onDragEnd(event: DragEndEvent) {
    const over = event.over?.id;
    const id = event.active.id;
    if (typeof over !== "string" || typeof id !== "string") return;
    if (!over.startsWith("col-")) return;
    const status = over.slice(4) as Status;
    const current = contents.find((c) => c.id === id);
    if (!current || current.status === status) return;
    setError(null);
    if (status === "scheduled" && !current.planned) {
      setError(
        `« ${current.title} » n'a pas de date prévue — pose une date (fiche ou calendrier) avant de passer en Planifié.`,
      );
      return;
    }
    // Optimiste : la carte change de colonne immédiatement.
    await mutate(
      (prev) =>
        prev
          ? {
              ...prev,
              contents: prev.contents.map((c) =>
                c.id === id ? { ...c, status } : c,
              ),
            }
          : prev,
      { revalidate: false },
    );
    const result = await patchContent(id, { fm: { status } });
    if (!result.ok) {
      setError(result.error);
      await mutate();
    }
  }

  return (
    <div className="mx-auto flex max-w-[1840px] flex-col gap-4 px-7 pb-12 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.025em]">
          Kanban
        </h1>
      </div>
      <FilterBar filters={filters} onChange={setFilters} showStatus={false} />
      <div className="flex flex-wrap items-center gap-2">
        <EmitterViewGroup />
        <ColumnsMenu hidden={hidden} onToggle={toggle} onShowAll={showAll} />
      </div>
      {error && <p className="text-sm text-[var(--peach)]">{error}</p>}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {/* Seules les colonnes visibles sont rendues ; onDragEnd accepte tous les statuts. */}
          {STATUSES.filter((s) => !hidden.has(s)).map((status) => {
            const items = byStatus.get(status) ?? [];
            const isExpanded = expanded.has(status);
            const shown = isExpanded ? items : items.slice(0, COLUMN_CAP);
            const hidden = items.length - shown.length;
            return (
              <Column key={status} status={status} count={items.length}>
                {shown.map((c) => (
                  <ContentCard
                    key={c.id}
                    content={c}
                    onOpen={setPeekId}
                    showEmitter={activeView === "all" || activeView === null}
                  />
                ))}
                {hidden > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => new Set(prev).add(status))}
                    className="rounded-lg border border-dashed border-[var(--hairline)] px-2 py-2 text-[11px] text-muted-foreground transition-colors hover:border-[var(--sky-soft)] hover:text-foreground"
                  >
                    Voir {hidden} de plus
                  </button>
                )}
                {isExpanded && items.length > COLUMN_CAP && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        next.delete(status);
                        return next;
                      })
                    }
                    className="rounded-lg px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Réduire
                  </button>
                )}
                {status === "published" && olderPublished > 0 && hidden === 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllPublished(true)}
                    className="rounded-lg border border-dashed border-[var(--hairline)] px-2 py-2 text-[11px] text-muted-foreground transition-colors hover:border-[var(--sky-soft)] hover:text-foreground"
                  >
                    + {olderPublished} publié{olderPublished > 1 ? "s" : ""} il y a plus de 14 jours
                  </button>
                )}
              </Column>
            );
          })}
        </div>
      </DndContext>
      <ContentPeek id={peekId} onClose={() => setPeekId(null)} />
    </div>
  );
}
