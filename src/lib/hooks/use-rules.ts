"use client";

import useSWR, { mutate as globalMutate } from "swr";
import type { Rules, RulesInput } from "@/lib/types/rules";

/** Règles éditoriales. Hors `Content/`, donc hors du flux SSE : c'est l'écriture qui recharge. */

const KEY = "/api/rules";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? res.statusText);
  return res.json();
};

export function useRules() {
  const { data, error, isLoading } = useSWR<Rules>(KEY, fetcher, { keepPreviousData: true });
  return { rules: data ?? null, error, isLoading };
}

export async function saveRules(input: RulesInput): Promise<Rules> {
  const res = await fetch(KEY, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(typeof json?.error === "string" ? json.error : "Enregistrement impossible");
  }
  await globalMutate(KEY, json, { revalidate: false });
  return json as Rules;
}
