"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { EMITTER_ACCENTS, EMITTER_LABELS } from "@/lib/labels";
import { EMITTERS, type Emitter } from "@/lib/types/content";
import { cn } from "@/lib/utils";
import type { Filters } from "@/components/content/filter-bar";

/**
 * Vues par émetteur (Tout · Caroline · Ryse), communes au calendrier
 * et au kanban. Le choix est mémorisé dans le navigateur : chacun retrouve sa
 * vue à l'ouverture sans refiltrer. Le sélecteur s'affiche en groupe de boutons
 * sous la barre de recherche (`EmitterViewGroup`).
 */
export const VIEW_EMITTERS: Emitter[] = ["caroline", "ryse"];
const STORAGE_KEY = "torch.view";
/** Clé d'avant le partage avec le kanban, lue en repli. */
const LEGACY_KEY = "torch.calendar.view";
/** Événement interne : une vue vient d'être choisie (barre latérale comprise). */
const VIEW_EVENT = "torch:view-changed";
export type ViewKey = "all" | Emitter;

export function readStoredView(): ViewKey {
  try {
    const v = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    return v && (EMITTERS as readonly string[]).includes(v) ? (v as Emitter) : "all";
  } catch {
    return "all";
  }
}

/* localStorage exposé comme store externe : le serveur rend « Tout », le
   client rebascule sur la vue mémorisée juste après l'hydratation. */
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}
function writeStoredView(view: ViewKey) {
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // Navigation privée : la vue ne survivra pas au rechargement, rien de grave.
  }
  listeners.forEach((cb) => cb());
  window.dispatchEvent(new CustomEvent(VIEW_EVENT));
}

/** Vue mémorisée, lisible et modifiable de n'importe où (barre latérale). */
export function useStoredView(): [ViewKey, (next: ViewKey) => void] {
  const view = useSyncExternalStore(subscribe, readStoredView, () => "all" as ViewKey);
  return [view, writeStoredView];
}

/**
 * Combine la vue mémorisée et les filtres de la barre. Un filtre Émetteur
 * posé à la main prend le pas sur la vue (aucune personne sélectionnée) ;
 * choisir une personne dans la barre latérale efface ce filtre manuel.
 */
export function useEmitterView(
  filters: Filters,
  setFilters: (update: (f: Filters) => Filters) => void,
) {
  const view = useSyncExternalStore(subscribe, readStoredView, () => "all" as ViewKey);
  const activeView: ViewKey | null = filters.emitter.length === 0 ? view : null;
  const effectiveFilters = useMemo<Filters>(
    () =>
      filters.emitter.length === 0 && view !== "all"
        ? { ...filters, emitter: [view] }
        : filters,
    [filters, view],
  );

  useEffect(() => {
    const onPick = () => setFilters((f) => (f.emitter.length ? { ...f, emitter: [] } : f));
    window.addEventListener(VIEW_EVENT, onPick);
    return () => window.removeEventListener(VIEW_EVENT, onPick);
  }, [setFilters]);

  function selectView(next: ViewKey) {
    setFilters((f) => ({ ...f, emitter: [] }));
    writeStoredView(next);
  }
  return { activeView, effectiveFilters, selectView };
}

/**
 * Sélecteur « qui publie », en groupe de boutons sous la barre de recherche.
 * (Il vivait dans la barre latérale jusqu'au 2026-09-21.)
 */
export function EmitterViewGroup() {
  const [view, setView] = useStoredView();
  const items: { key: ViewKey; label: string; color: string | null }[] = [
    { key: "all", label: "Tout", color: null },
    ...VIEW_EMITTERS.map((e) => ({
      key: e as ViewKey,
      label: EMITTER_LABELS[e],
      color: EMITTER_ACCENTS[e],
    })),
  ];

  return (
    <div className="flex h-9 items-center rounded-lg border border-[var(--hairline)] bg-[var(--paper)] p-0.5">
      {items.map((item) => {
        const active = item.key === view;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => setView(item.key)}
            className={cn(
              "flex h-full items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors",
              active
                ? "bg-[var(--ink)] font-medium text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.color && (
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
            )}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
