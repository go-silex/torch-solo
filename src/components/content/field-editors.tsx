"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/labels";
import { STATUSES, type Status } from "@/lib/types/content";

export function SidebarSection({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--hairline)] bg-[var(--paper)]/85 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="micro-label text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ---------- Ligne de propriété (façon table de propriétés) ---------- */

export function PropertyRow<T extends string>({
  label,
  values,
  labels,
  selected,
  onSelect,
  onSelectMulti,
  multi = false,
  renderValue,
}: {
  label: string;
  values: readonly T[];
  labels: Record<T, string>;
  selected: T | T[];
  onSelect?: (value: T) => void;
  onSelectMulti?: (values: T[]) => void;
  multi?: boolean;
  /** Rendu custom de la valeur courante (ex : badge coloré). */
  renderValue?: (selected: T[]) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = Array.isArray(selected) ? selected : [selected];

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative flex items-center justify-between gap-3 border-b border-[var(--hairline-soft)] py-2 last:border-0"
    >
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] transition-colors hover:bg-[var(--mist)]/40"
      >
        <span className="truncate">
          {renderValue
            ? renderValue(current)
            : current.length
              ? current.map((v) => labels[v]).join(", ")
              : "—"}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover:text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-40 mt-1 max-h-64 min-w-44 overflow-y-auto rounded-xl border border-[var(--hairline)] bg-[var(--paper)] p-1 shadow-[0_12px_36px_rgba(3,22,53,0.12)]">
          {values.map((v) => {
            const active = current.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => {
                  if (multi && onSelectMulti) {
                    onSelectMulti(
                      active ? current.filter((s) => s !== v) : [...current, v],
                    );
                  } else if (onSelect) {
                    onSelect(v);
                    setOpen(false);
                  }
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-accent"
              >
                {labels[v]}
                {active && <Check className="size-3.5 text-[var(--sky)]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------- Stepper de workflow éditorial ---------- */

/**
 * Toutes les étapes, quel que soit le format : on les propose partout et c'est
 * à l'auteur de sauter celles qui ne le concernent pas. Seul « archivé » reste
 * hors du chemin — ce n'est pas une étape, c'est une sortie.
 */
const STEPS: Status[] = STATUSES.filter((s) => s !== "archived");

export function WorkflowStepper({
  current,
  onSelect,
}: {
  current: Status;
  onSelect: (status: Status) => void;
}) {
  const idx = STEPS.indexOf(current);
  return (
    <div className="flex items-start">
      {STEPS.map((step, i) => {
        const done = idx >= 0 && i < idx;
        const active = i === idx;
        return (
          <div key={step} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <div
                className={cn(
                  "h-px flex-1",
                  i === 0 ? "bg-transparent" : done || active ? "bg-[var(--sky)]" : "bg-[var(--hairline)]",
                )}
              />
              <button
                type="button"
                onClick={() => onSelect(step)}
                title={STATUS_LABELS[step]}
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border transition-all",
                  active
                    ? "scale-110 border-[var(--ink)] bg-[var(--ink)]"
                    : done
                      ? "border-[var(--sky)] bg-[var(--sky)]"
                      : "border-[var(--hairline)] bg-[var(--paper)] hover:border-[var(--sky)]",
                )}
              >
                {(done || active) && <Check className="size-3 text-white" strokeWidth={3} />}
              </button>
              <div
                className={cn(
                  "h-px flex-1",
                  i === STEPS.length - 1 ? "bg-transparent" : done ? "bg-[var(--sky)]" : "bg-[var(--hairline)]",
                )}
              />
            </div>
            <button
              type="button"
              onClick={() => onSelect(step)}
              className={cn(
                "text-[10px] leading-tight transition-colors",
                active
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {STATUS_LABELS[step]}
            </button>
          </div>
        );
      })}
    </div>
  );
}
