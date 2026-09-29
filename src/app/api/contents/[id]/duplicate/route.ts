import { NextRequest, NextResponse } from "next/server";
import { runWithOperator } from "@/lib/operator";
import { getStore } from "@/lib/vault/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** POST : duplique la fiche (idée, sans date), renvoie la copie. */
export async function POST(req: NextRequest, { params }: Params) {
  return runWithOperator(req, async () => {
    const { id } = await params;
    const store = await getStore();
    try {
      const entry = await store.duplicateContent(id);
      return NextResponse.json(
        { ...entry.fm, mtimeMs: entry.mtimeMs, obsidianUrl: store.obsidianUrl(entry) },
        { status: 201 },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Duplication impossible";
      const status = message.startsWith("Fiche introuvable") ? 404 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  });
}
