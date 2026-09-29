"use client";

import { useSyncExternalStore } from "react";
import { STATUSES, type Status } from "@/lib/types/content";

/**
 * Colonnes masquées du kanban, mémorisées par navigateur.
 *
 * Par défaut les quatre étapes de production sont masquées : elles ne
 * concernent que la vidéo, et personne ne doit voir son tableau s'allonger
 * sans l'avoir demandé.
 */

const KEY = "torch.kanban.hidden";
const DEFAULT_HIDDEN: Status[] = ["to-shoot", "shot", "to-edit", "edited"];

const listeners = new Set<() => void>();

/** `null` = jamais choisi (on applique le défaut) ; `""` = tout afficher. */
function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function read(): string {
  const raw = readRaw();
  if (raw === null) return DEFAULT_HIDDEN.join(",");
  return raw;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function write(hidden: Status[]) {
  try {
    localStorage.setItem(KEY, hidden.join(","));
  } catch {
    // Navigation privée : le choix ne survivra pas au rechargement.
  }
  listeners.forEach((cb) => cb());
}

/** Statuts masqués, et la bascule. Le serveur rend le défaut. */
export function useHiddenColumns(): {
  hidden: Set<Status>;
  toggle: (status: Status) => void;
  showAll: () => void;
} {
  const raw = useSyncExternalStore(subscribe, read, () => DEFAULT_HIDDEN.join(","));
  const hidden = new Set(
    raw
      .split(",")
      .filter((s): s is Status => (STATUSES as readonly string[]).includes(s)),
  );
  return {
    hidden,
    toggle: (status) => {
      const next = new Set(hidden);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      write(STATUSES.filter((s) => next.has(s)));
    },
    showAll: () => write([]),
  };
}
