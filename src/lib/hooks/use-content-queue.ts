"use client";

import { useSyncExternalStore } from "react";

/**
 * File de lecture : l'ordre des fiches tel qu'il était affiché au moment où on
 * en a ouvert une. Les flèches de la fiche suivent cette file.
 *
 * Pourquoi mémoriser la liste plutôt que recalculer un ordre « logique » :
 * l'ordre affiché dépend de la vue (calendrier, kanban, bibliothèque), des
 * filtres, du tri et de la personne sélectionnée. Recalculer donnerait des
 * voisins que l'utilisateur n'a jamais vus. On fige donc ce qui était à
 * l'écran — et cette file ne bouge plus tant qu'on n'est pas retourné sur une
 * liste, pour que « suivant » ne change pas de sens sous les doigts.
 */

const KEY = "torch.queue";

type Queue = { from: string; ids: string[] };
const EMPTY: Queue = { from: "", ids: [] };

const listeners = new Set<() => void>();
/** Dernier JSON lu, pour rendre un objet stable à useSyncExternalStore. */
let cachedRaw: string | null = null;
let cachedQueue: Queue = EMPTY;

function read(): Queue {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cachedQueue;
  cachedRaw = raw;
  if (!raw) {
    cachedQueue = EMPTY;
    return cachedQueue;
  }
  try {
    const parsed = JSON.parse(raw) as Queue;
    cachedQueue =
      Array.isArray(parsed?.ids) && parsed.ids.every((v) => typeof v === "string")
        ? parsed
        : EMPTY;
  } catch {
    cachedQueue = EMPTY;
  }
  return cachedQueue;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Appelé par une vue de liste à chaque rendu : n'écrit que si l'ordre a
 * réellement changé, sinon chaque revalidation SWR réveillerait les abonnés.
 */
export function rememberQueue(from: string, ids: string[]) {
  const next = JSON.stringify({ from, ids });
  try {
    if (sessionStorage.getItem(KEY) === next) return;
    sessionStorage.setItem(KEY, next);
  } catch {
    return; // navigation privée : on retombera sur l'ordre par défaut
  }
  cachedRaw = next;
  cachedQueue = { from, ids };
  listeners.forEach((cb) => cb());
}

export type Neighbours = {
  prev: string | null;
  next: string | null;
  /** Rang dans la file, à partir de 1. 0 si la fiche n'y est pas. */
  position: number;
  total: number;
};

/** Partie pure, testable : voisins de `id` dans `ids`. */
export function neighboursIn(ids: string[], id: string): Neighbours {
  const i = ids.indexOf(id);
  if (i === -1) return { prev: null, next: null, position: 0, total: ids.length };
  return {
    prev: i > 0 ? ids[i - 1] : null,
    next: i < ids.length - 1 ? ids[i + 1] : null,
    position: i + 1,
    total: ids.length,
  };
}

/**
 * Voisins de `id`. `fallback` sert quand la fiche n'est pas dans la file —
 * ouverte par la palette, par un lien direct ou depuis une vue qui n'en tient
 * pas (auquel cas on navigue dans l'ordre du calendrier).
 */
export function useNeighbours(id: string, fallback: string[]): Neighbours {
  const queue = useSyncExternalStore(subscribe, read, () => EMPTY);
  return neighboursIn(queue.ids.includes(id) ? queue.ids : fallback, id);
}
