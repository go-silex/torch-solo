"use client";

import { useState } from "react";
import { EMITTER_ACCENTS, EMITTER_LABELS, FORMAT_LABELS } from "@/lib/labels";
import { EMITTERS, type Format } from "@/lib/types/content";
import { VIEW_EMITTERS } from "@/components/content/view-tabs";
import type { ContentListItem } from "@/lib/hooks/use-contents";
import { cn } from "@/lib/utils";

/**
 * Publications par personne sur la période, plus le total. Les barres sont à
 * l'échelle du total : la hauteur de chacun se lit comme sa part. Au survol,
 * le détail par format et la dernière date.
 */

type Bar = {
  key: string;
  label: string;
  color: string;
  count: number;
  byFormat: [Format, number][];
  last: string | null;
};

function publishedDate(c: ContentListItem): string | null {
  return c["published-at"] ?? c.planned ?? null;
}

function buildBar(key: string, label: string, color: string, items: ContentListItem[]): Bar {
  const counts = new Map<Format, number>();
  let last: string | null = null;
  for (const c of items) {
    counts.set(c.format, (counts.get(c.format) ?? 0) + 1);
    const d = publishedDate(c);
    if (d && (last === null || d > last)) last = d;
  }
  return {
    key,
    label,
    color,
    count: items.length,
    byFormat: [...counts.entries()].sort((a, b) => b[1] - a[1]),
    last,
  };
}

export function PublishedChart({
  contents,
  periodLabel,
}: {
  /** Contenus publiés, déjà restreints à la période. */
  contents: ContentListItem[];
  periodLabel: string;
}) {
  const present = EMITTERS.filter(
    (e) => VIEW_EMITTERS.includes(e) || contents.some((c) => c.emitter === e),
  );
  const bars: Bar[] = [
    ...present.map((e) =>
      buildBar(
        e,
        EMITTER_LABELS[e],
        EMITTER_ACCENTS[e],
        contents.filter((c) => c.emitter === e),
      ),
    ),
    buildBar("total", "Total", "var(--ink)", contents),
  ];
  // Échelle sur le total : chaque personne se lit comme une part de l'ensemble.
  const scale = Math.max(contents.length, 1);
  const [hovered, setHovered] = useState<string | null>(null);
  const detail = bars.find((b) => b.key === hovered) ?? null;

  return (
    <section className="relative rounded-2xl border border-[var(--hairline)] bg-[var(--paper)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-[18px] tracking-tight">Publications</h2>
        <span className="text-[12px] text-muted-foreground">{periodLabel}</span>
      </div>

      {/* Détail du survol : panneau fixe, à droite du graphe (il ne déborde jamais). */}
      {detail && (
        <div className="pointer-events-none absolute right-5 top-14 z-20 w-52 rounded-xl border border-[var(--hairline)] bg-[var(--paper)] p-3 shadow-[0_12px_36px_rgba(3,22,53,0.12)]">
          <p className="text-[13px] font-medium">{detail.label}</p>
          <p className="text-[12px] text-muted-foreground">
            {detail.count} publication{detail.count > 1 ? "s" : ""}
            {detail.key !== "total" &&
              detail.count > 0 &&
              ` · ${Math.round((detail.count / scale) * 100)} % du total`}
          </p>
          <ul className="mt-2 flex flex-col gap-0.5">
            {detail.byFormat.map(([format, n]) => (
              <li key={format} className="flex justify-between gap-3 text-[12px]">
                <span className="text-muted-foreground">{FORMAT_LABELS[format]}</span>
                <span className="tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
          {detail.last && (
            <p className="mt-2 border-t border-[var(--hairline-soft)] pt-1.5 text-[11px] text-muted-foreground">
              Dernière : {detail.last.slice(8)}/{detail.last.slice(5, 7)}
            </p>
          )}
        </div>
      )}

      {contents.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Rien de publié sur la période.
        </p>
      ) : (
        <div className="mt-5 flex h-48 items-end gap-7">
          {bars.map((bar) => (
            <div
              key={bar.key}
              onMouseEnter={() => setHovered(bar.key)}
              onMouseLeave={() => setHovered((h) => (h === bar.key ? null : h))}
              className="group relative flex h-full w-20 flex-col justify-end"
            >
              <span className="mb-1 text-center text-[13px] font-medium tabular-nums">
                {bar.count}
              </span>
              <div
                className={cn(
                  "w-full rounded-t-md transition-opacity group-hover:opacity-85",
                  bar.count === 0 && "min-h-[2px]",
                )}
                style={{
                  height: `${(bar.count / scale) * 100}%`,
                  backgroundColor: bar.color,
                  opacity: bar.key === "total" ? 0.9 : 1,
                }}
              />
              <span className="mt-2 truncate text-center text-[12px] text-muted-foreground">
                {bar.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
