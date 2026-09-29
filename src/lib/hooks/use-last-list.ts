"use client";

import { useSyncExternalStore } from "react";

/**
 * Dernière vue de liste visitée. Le lien « retour » d'une fiche y ramène :
 * on repart d'où l'on vient, et du calendrier par défaut (c'est de là qu'on
 * ouvre une fiche neuf fois sur dix).
 */

const KEY = "torch.last-list";
const DEFAULT: ListRoute = "/calendar";

export const LIST_ROUTES = ["/calendar", "/kanban", "/library", "/performances"] as const;
export type ListRoute = (typeof LIST_ROUTES)[number];

/** Dupliqué de la navigation de la coque, pour éviter un import circulaire. */
const LIST_LABELS: Record<ListRoute, string> = {
  "/calendar": "Calendrier",
  "/kanban": "Kanban",
  "/library": "Bibliothèque",
  "/performances": "Data",
};

function routeOf(pathname: string | null): ListRoute | null {
  return LIST_ROUTES.find((r) => pathname?.startsWith(r)) ?? null;
}

const listeners = new Set<() => void>();

/** Appelé par la coque à chaque navigation. */
export function rememberList(pathname: string | null) {
  const route = routeOf(pathname);
  if (!route) return;
  try {
    if (sessionStorage.getItem(KEY) === route) return;
    sessionStorage.setItem(KEY, route);
  } catch {
    // Navigation privée : le retour retombera sur le calendrier.
    return;
  }
  listeners.forEach((cb) => cb());
}

function read(): ListRoute {
  try {
    const v = sessionStorage.getItem(KEY);
    return (LIST_ROUTES as readonly string[]).includes(v ?? "") ? (v as ListRoute) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Destination du lien « retour » : href et libellé. */
export function useLastList(): { href: ListRoute; label: string } {
  const href = useSyncExternalStore(subscribe, read, () => DEFAULT);
  return { href, label: LIST_LABELS[href] };
}
