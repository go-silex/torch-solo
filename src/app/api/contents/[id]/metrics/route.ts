import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runWithOperator } from "@/lib/operator";
import { getStore } from "@/lib/vault/store";
import { getVisitCount } from "@/lib/services/shlink-client";
import type { ContentFrontmatter } from "@/lib/types/content";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const MetricValues = z.record(
  z.string(),
  z.union([z.number(), z.null()]),
);

/** POST : saisie manuelle des métriques par plateforme (merge ; null efface la valeur). */
const BodySchema = z.object({
  metrics: z.record(z.string(), MetricValues),
  refreshClicks: z.boolean().optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  return runWithOperator(req, async () => {
    const { id } = await params;
    const store = await getStore();
    const entry = store.getContent(id);
    if (!entry) {
      return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
    }
    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Merge plateforme par plateforme (les clés absentes survivent).
    const merged: Record<string, unknown> = { ...entry.fm.metrics };
    for (const [platform, values] of Object.entries(parsed.data.metrics)) {
      const prev =
        typeof merged[platform] === "object" && merged[platform] !== null
          ? (merged[platform] as Record<string, unknown>)
          : {};
      const next: Record<string, unknown> = { ...prev };
      for (const [key, value] of Object.entries(values)) {
        if (value === null) delete next[key];
        else next[key] = value;
      }
      merged[platform] = next;
    }

    if (parsed.data.refreshClicks && entry.fm["shortlink-slug"]) {
      try {
        merged.clicks = await getVisitCount(entry.fm["shortlink-slug"]);
      } catch {
        // Shlink injoignable — la saisie manuelle reste enregistrée.
      }
    }

    const patched = await store.patchContent(id, {
      fm: {
        metrics: merged as ContentFrontmatter["metrics"],
        "metrics-updated": new Date().toISOString().slice(0, 10),
      },
    });
    return NextResponse.json({
      ...patched.fm,
      body: patched.body,
      mtimeMs: patched.mtimeMs,
    });
  });
}
