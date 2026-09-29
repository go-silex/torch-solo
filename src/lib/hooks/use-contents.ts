"use client";

import { useEffect } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import type { ContentFrontmatter, ContentPatch } from "@/lib/types/content";
import type { QuarantineEntry } from "@/lib/vault/store";

export type ContentListItem = ContentFrontmatter & {
  mtimeMs: number;
  /** Absent des réponses d'écriture (PATCH, vignette) : relu au GET suivant. */
  obsidianUrl?: string;
};
export type ContentDetail = ContentListItem & { body: string };

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? res.statusText);
  return res.json();
};

function revalidateAll() {
  void globalMutate((key) => typeof key === "string" && key.startsWith("/api/contents"), undefined, {
    revalidate: true,
  });
}

/**
 * Écritures faites par cet onglet : le serveur renvoie l'événement à tout le
 * monde, y compris à nous, ce qui rechargeait toutes les listes une deuxième
 * fois (clignotement pendant la frappe, toutes les 30 s à l'enregistrement
 * automatique). On ignore donc l'écho de nos propres écritures : la vue locale
 * est déjà à jour.
 */
const SELF_ECHO_MS = 8000;
const selfWrites = new Map<string, number>();

function markSelfWrite(id: string) {
  selfWrites.set(id, Date.now());
}

function isSelfEcho(id: unknown): boolean {
  if (typeof id !== "string") return false;
  const at = selfWrites.get(id);
  if (at === undefined) return false;
  if (Date.now() - at > SELF_ECHO_MS) {
    selfWrites.delete(id);
    return false;
  }
  return true;
}

/** Connexion SSE partagée : toute modif vault → revalidation SWR. */
let sseStarted = false;
function ensureSse() {
  if (sseStarted || typeof window === "undefined") return;
  sseStarted = true;
  const source = new EventSource("/api/events");
  source.onmessage = (event) => {
    let id: unknown;
    try {
      id = (JSON.parse(event.data) as { id?: unknown })?.id;
    } catch {
      // Message illisible : on recharge, c'est le comportement sûr.
    }
    if (isSelfEcho(id)) return;
    revalidateAll();
  };
  source.onerror = () => {
    // Le navigateur retente tout seul.
  };
}

export function useContents(query?: string) {
  useEffect(ensureSse, []);
  const key = query ? `/api/contents?${query}` : "/api/contents";
  const { data, error, isLoading, mutate } = useSWR<{
    contents: ContentListItem[];
    quarantine: QuarantineEntry[];
  }>(key, fetcher, { keepPreviousData: true });
  return {
    contents: data?.contents ?? [],
    quarantine: data?.quarantine ?? [],
    error,
    isLoading,
    mutate,
  };
}

export function useContent(id: string | null) {
  useEffect(ensureSse, []);
  const { data, error, isLoading, mutate } = useSWR<ContentDetail>(
    id ? `/api/contents/${id}` : null,
    fetcher,
    // Pas de rechargement au retour sur l'onglet : on peut être en train
    // d'écrire dans la fiche, et le vault reste annoncé par le flux SSE.
    { revalidateOnFocus: false },
  );
  return { content: data ?? null, error, isLoading, mutate };
}

export async function patchContent(
  id: string,
  patch: { fm?: ContentPatch; body?: string; ifBodyUnmodifiedSince?: number },
  /**
   * `lists` (défaut) recharge les listes ; `none` ne recharge rien — pour
   * l'enregistrement du corps d'une fiche, que les listes n'affichent pas.
   */
  opts: { revalidate?: "lists" | "none" } = {},
): Promise<{ ok: true; content: ContentDetail } | { ok: false; status: number; error: string }> {
  // Marqué AVANT l'envoi : le serveur diffuse l'événement pendant qu'il écrit,
  // donc l'écho arrive souvent avant la réponse du PATCH.
  markSelfWrite(id);
  const res = await fetch(`/api/contents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: typeof json?.error === "string" ? json.error : "Erreur d'écriture",
    };
  }
  markSelfWrite(id);
  if (opts.revalidate !== "none") revalidateAll();
  return { ok: true, content: json };
}

export async function createContent(input: Record<string, unknown>) {
  const res = await fetch("/api/contents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(typeof json?.error === "string" ? json.error : "Création impossible");
  }
  if (typeof json?.id === "string") markSelfWrite(json.id);
  revalidateAll();
  return json as ContentListItem;
}

/** Duplique une fiche (POST /duplicate) et renvoie la copie. */
export async function duplicateContent(id: string) {
  const res = await fetch(`/api/contents/${id}/duplicate`, { method: "POST" });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(typeof json?.error === "string" ? json.error : "Duplication impossible");
  }
  if (typeof json?.id === "string") markSelfWrite(json.id);
  revalidateAll();
  return json as ContentListItem;
}

/** Signature d'écriture lisible : « Arman, 15/09 14:32 ». */
export function formatSignature(c: { "updated-by": string | null; "updated-at": string | null }) {
  if (!c["updated-at"]) return null;
  const d = new Date(c["updated-at"]);
  const when = Number.isNaN(d.getTime())
    ? c["updated-at"]
    : d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return c["updated-by"] ? `${c["updated-by"]}, ${when}` : when;
}
