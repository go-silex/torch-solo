"use client";

import useSWR, { mutate as globalMutate } from "swr";
import type { Theme, ThemeInput } from "@/lib/types/theme";

/**
 * Thèmes éditoriaux. Volontairement à part de `use-contents` : ils ne vivent
 * pas dans `Content/`, donc le flux SSE (qui ne suit que les fiches) ne les
 * annonce pas — c'est l'écriture elle-même qui recharge la liste.
 */

const KEY = "/api/themes";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => null))?.error ?? res.statusText,
    );
  return res.json();
};

export function useThemes() {
  const { data, error, isLoading } = useSWR<{ themes: Theme[] }>(KEY, fetcher, {
    keepPreviousData: true,
  });
  return { themes: data?.themes ?? [], error, isLoading };
}

async function send(url: string, method: string, body?: ThemeInput) {
  const res = await fetch(url, {
    method,
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(
      typeof json?.error === "string"
        ? json.error
        : "Enregistrement impossible",
    );
  }
  await globalMutate(KEY);
}

export const createTheme = (input: ThemeInput) => send(KEY, "POST", input);
export const updateTheme = (id: string, input: ThemeInput) =>
  send(`${KEY}/${encodeURIComponent(id)}`, "PATCH", input);
export const deleteTheme = (id: string) =>
  send(`${KEY}/${encodeURIComponent(id)}`, "DELETE");
