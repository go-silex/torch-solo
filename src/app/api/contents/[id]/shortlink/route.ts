import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runWithOperator } from "@/lib/operator";
import { getStore } from "@/lib/vault/store";
import {
  ShlinkError,
  createShortlink,
  deleteShortlink,
} from "@/lib/services/shlink-client";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const BodySchema = z.object({ longUrl: z.string().url() });

/** POST : crée (idempotent) le shortlink s.gosilex.com du contenu. */
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
      return NextResponse.json(
        { error: "longUrl (URL cible) requis" },
        { status: 400 },
      );
    }
    try {
      const { slug, shortUrl } = await createShortlink(entry.fm, parsed.data.longUrl);
      const patched = await store.patchContent(id, {
        fm: { "shortlink-slug": slug, shortlink: shortUrl },
      });
      return NextResponse.json({
        ...patched.fm,
        body: patched.body,
        mtimeMs: patched.mtimeMs,
      });
    } catch (err) {
      const message =
        err instanceof ShlinkError
          ? err.message
          : `Shlink injoignable : ${err instanceof Error ? err.message : String(err)}`;
      return NextResponse.json({ error: message }, { status: 502 });
    }
  });
}

/** DELETE : supprime le shortlink chez Shlink et le détache de la fiche. */
export async function DELETE(req: NextRequest, { params }: Params) {
  return runWithOperator(req, async () => {
    const { id } = await params;
    const store = await getStore();
    const entry = store.getContent(id);
    if (!entry) {
      return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
    }
    const slug = entry.fm["shortlink-slug"];
    if (!slug && !entry.fm.shortlink) {
      return NextResponse.json(
        { error: "Aucun shortlink sur cette fiche" },
        { status: 400 },
      );
    }
    try {
      if (slug) await deleteShortlink(slug);
      // metrics.clicks venait de ce lien : la valeur serait orpheline, on la retire.
      const metrics = { ...entry.fm.metrics };
      delete metrics.clicks;
      const patched = await store.patchContent(id, {
        fm: { "shortlink-slug": null, shortlink: null, metrics },
      });
      return NextResponse.json({
        ...patched.fm,
        body: patched.body,
        mtimeMs: patched.mtimeMs,
      });
    } catch (err) {
      const message =
        err instanceof ShlinkError
          ? err.message
          : `Shlink injoignable : ${err instanceof Error ? err.message : String(err)}`;
      return NextResponse.json({ error: message }, { status: 502 });
    }
  });
}
