"use client";

import { useSyncExternalStore } from "react";

/**
 * Préférence d'affichage mémorisée dans le navigateur (localStorage), lue via
 * useSyncExternalStore : le serveur rend la valeur par défaut, le client
 * rebascule sur la valeur mémorisée juste après l'hydratation.
 */
const listeners = new Map<string, Set<() => void>>();

function subscribeKey(key: string) {
  return (cb: () => void) => {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(cb);
    window.addEventListener("storage", cb);
    return () => {
      listeners.get(key)?.delete(cb);
      window.removeEventListener("storage", cb);
    };
  };
}

export function useStoredPref<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[],
): [T, (next: T) => void] {
  const read = () => {
    try {
      const v = localStorage.getItem(key);
      return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
    } catch {
      return fallback;
    }
  };
  const value = useSyncExternalStore(subscribeKey(key), read, () => fallback);
  function set(next: T) {
    try {
      localStorage.setItem(key, next);
    } catch {
      // Navigation privée : la préférence ne survivra pas au rechargement.
    }
    listeners.get(key)?.forEach((cb) => cb());
  }
  return [value, set];
}
