import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getSetting } from "@/lib/config";
import { getStore } from "@/lib/vault/store";
import type { ContentFrontmatter } from "@/lib/types/content";

const execFileAsync = promisify(execFile);

/**
 * Client Shlink (shortlinks s.gosilex.com).
 * Clé : SHLINK_API_KEY (env / torch.env), fallback Keychain macOS
 * (`security find-generic-password -s SHLINK_API_KEY -w`) — même source que
 * le CLI ~/.local/bin/shlink.
 */

const API_BASE = () =>
  (getSetting("SHLINK_API_BASE") ?? "https://s.gosilex.com/rest/v3").replace(/\/$/, "");

export class ShlinkError extends Error {}

let cachedKey: string | null | undefined;

export async function getShlinkKey(): Promise<string | null> {
  if (cachedKey !== undefined) return cachedKey;
  const fromEnv = getSetting("SHLINK_API_KEY");
  if (fromEnv) {
    cachedKey = fromEnv;
    return cachedKey;
  }
  if (process.platform === "darwin") {
    try {
      const { stdout } = await execFileAsync("security", [
        "find-generic-password",
        "-s",
        "SHLINK_API_KEY",
        "-w",
      ]);
      cachedKey = stdout.trim() || null;
      return cachedKey;
    } catch {
      // pas de clé dans le Keychain
    }
  }
  cachedKey = null;
  return null;
}

export function shlinkConfigured(): boolean {
  // Vérification rapide synchrone (env) ; le Keychain est testé à l'usage.
  return process.platform === "darwin" || Boolean(getSetting("SHLINK_API_KEY"));
}

async function shlinkFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const key = await getShlinkKey();
  if (!key) {
    throw new ShlinkError(
      "Clé Shlink introuvable (SHLINK_API_KEY dans torch.env ou Keychain macOS).",
    );
  }
  const res = await fetch(`${API_BASE()}${path}`, {
    ...init,
    headers: {
      "X-Api-Key": key,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ShlinkError(`Shlink ${res.status} sur ${path} : ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export function slugForContent(id: string): string {
  // t-<slug> : id sans la date, en kebab-case (max ~40 chars).
  return (
    "t-" +
    id
      .replace(/^\d{4}-\d{2}-\d{2}_/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40)
  );
}

export async function createShortlink(
  fm: ContentFrontmatter,
  longUrl: string,
): Promise<{ slug: string; shortUrl: string }> {
  const slug = slugForContent(fm.id);
  const tags = [
    "torch",
    fm.emitter,
    ...(fm.pillar !== "none" ? [fm.pillar] : []),
    ...fm.platforms,
  ];
  const created = await shlinkFetch<{ shortUrl: string; shortCode: string }>(
    "/short-urls",
    {
      method: "POST",
      body: JSON.stringify({ longUrl, customSlug: slug, findIfExists: true, tags }),
    },
  );
  return { slug: created.shortCode ?? slug, shortUrl: created.shortUrl };
}

/** Supprime le shortlink chez Shlink. 404 = déjà absent, considéré ok. */
export async function deleteShortlink(slug: string): Promise<void> {
  const key = await getShlinkKey();
  if (!key) {
    throw new ShlinkError(
      "Clé Shlink introuvable (SHLINK_API_KEY dans torch.env ou Keychain macOS).",
    );
  }
  const res = await fetch(`${API_BASE()}/short-urls/${encodeURIComponent(slug)}`, {
    method: "DELETE",
    headers: { "X-Api-Key": key },
  });
  if (res.ok || res.status === 404) return;
  // 422 typique : Shlink refuse au-delà du seuil de visites (INVALID_SHORT_URL_DELETION).
  const body = await res.text().catch(() => "");
  throw new ShlinkError(
    `Shlink ${res.status} sur DELETE /short-urls/${slug} : ${body.slice(0, 200)}`,
  );
}

export async function getVisitCount(slug: string): Promise<number> {
  const data = await shlinkFetch<{
    visits: { pagination: { totalItems: number } };
  }>(`/short-urls/${encodeURIComponent(slug)}/visits?itemsPerPage=1`);
  return data.visits.pagination.totalItems;
}

/** Rafraîchit metrics.clicks des contenus publiés — n'écrit que si ça change. */
export async function refreshClicksForPublished(): Promise<number> {
  const store = await getStore();
  const candidates = store
    .listContents({ status: ["published"] })
    .filter((e) => e.fm["shortlink-slug"]);
  let updates = 0;
  for (const entry of candidates) {
    try {
      const clicks = await getVisitCount(entry.fm["shortlink-slug"]!);
      if (entry.fm.metrics.clicks !== clicks) {
        await store.patchContent(entry.fm.id, {
          fm: {
            metrics: { ...entry.fm.metrics, clicks },
            "metrics-updated": new Date().toISOString().slice(0, 10),
          },
        });
        updates += 1;
      }
    } catch {
      // Shlink injoignable : prochain tour.
    }
  }
  return updates;
}
