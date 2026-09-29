import { getStore } from "@/lib/vault/store";
import {
  flameConfigured,
  listAssets,
  mapReviewStatus,
} from "@/lib/services/flame-client";
import {
  refreshClicksForPublished,
  shlinkConfigured,
} from "@/lib/services/shlink-client";

/**
 * Boucles de fond (app locale, démarrées par instrumentation.ts) :
 * - Flame : statut de review des contenus au montage (5 min)
 * - Shlink : clics des shortlinks des contenus publiés (30 min)
 * N'écrivent dans le vault QUE si une valeur change (anti-bruit Drive).
 */

const FLAME_INTERVAL_MS = 5 * 60 * 1000;
const SHLINK_INTERVAL_MS = 30 * 60 * 1000;

export async function pollFlameOnce(): Promise<number> {
  if (!flameConfigured()) return 0;
  const store = await getStore();
  const candidates = store
    .listContents()
    .filter(
      (e) =>
        e.fm["flame-project"] &&
        e.fm["flame-folder"] &&
        e.fm["edit-status"] !== "approved" &&
        e.fm["edit-status"] !== "none",
    );
  let updates = 0;
  for (const entry of candidates) {
    try {
      const assets = await listAssets(
        entry.fm["flame-project"]!,
        entry.fm["flame-folder"]!,
      );
      if (!assets.length) continue;
      const latest = assets.reduce((a, b) =>
        new Date(a.createdAt).getTime() >= new Date(b.createdAt).getTime() ? a : b,
      );
      const mapped = mapReviewStatus(latest.reviewStatus);
      if (mapped !== entry.fm["edit-status"]) {
        await store.patchContent(entry.fm.id, {
          fm: { "edit-status": mapped },
        });
        updates += 1;
      }
    } catch {
      // Flame injoignable : on retentera au prochain tour, rien ne bloque.
    }
  }
  return updates;
}

export async function pollShlinkOnce(): Promise<number> {
  if (!shlinkConfigured()) return 0;
  return refreshClicksForPublished();
}

type PollerState = { started: boolean };
const globalPollers = globalThis as unknown as { __torchPollers?: PollerState };

export function startPollers() {
  if (globalPollers.__torchPollers?.started) return;
  globalPollers.__torchPollers = { started: true };

  const safe = (fn: () => Promise<unknown>) => () => {
    fn().catch(() => undefined);
  };
  setInterval(safe(pollFlameOnce), FLAME_INTERVAL_MS);
  setInterval(safe(pollShlinkOnce), SHLINK_INTERVAL_MS);
  // Premier passage rapide après le boot.
  setTimeout(safe(pollFlameOnce), 15_000);
  setTimeout(safe(pollShlinkOnce), 30_000);
}
