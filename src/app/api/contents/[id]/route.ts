import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runWithOperator } from "@/lib/operator";
import { ConflictError, getStore } from "@/lib/vault/store";
import { ContentPatchSchema } from "@/lib/types/content";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const store = await getStore();
  const entry = store.getContent(id);
  if (!entry) {
    return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
  }
  return NextResponse.json({
    ...entry.fm,
    body: entry.body,
    mtimeMs: entry.mtimeMs,
    obsidianUrl: store.obsidianUrl(entry),
  });
}

const PatchRequestSchema = z.object({
  fm: ContentPatchSchema.optional(),
  body: z.string().optional(),
  ifBodyUnmodifiedSince: z.number().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  return runWithOperator(req, async () => {
    const { id } = await params;
    const store = await getStore();
    const json = await req.json().catch(() => null);
    const parsed = PatchRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    try {
      const entry = await store.patchContent(id, parsed.data);
      return NextResponse.json({
        ...entry.fm,
        body: entry.body,
        mtimeMs: entry.mtimeMs,
      });
    } catch (err) {
      if (err instanceof ConflictError) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      const message = err instanceof Error ? err.message : "Erreur d'écriture";
      const status = message.startsWith("Fiche introuvable") ? 404 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  });
}

/** DELETE : suppression douce — la note part dans 1_Torch/_Trash/. */
export async function DELETE(req: NextRequest, { params }: Params) {
  return runWithOperator(req, async () => {
    const { id } = await params;
    const store = await getStore();
    try {
      await store.deleteContent(id);
      return NextResponse.json({ deleted: id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Suppression impossible";
      const status = message.startsWith("Fiche introuvable") ? 404 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  });
}
