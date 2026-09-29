import { NextRequest, NextResponse } from "next/server";
import { runWithOperator } from "@/lib/operator";
import { getStore } from "@/lib/vault/store";
import {
  FlameError,
  createShareLink,
  ensureFolder,
  ensureProject,
  flameConfigured,
} from "@/lib/services/flame-client";
import { FORMAT_DIRS } from "@/lib/types/content";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** POST : provisionne l'espace Flame d'un contenu (projet Torch → dossier → share link). */
export async function POST(req: NextRequest, { params }: Params) {
  return runWithOperator(req, async () => {
    const { id } = await params;
    const store = await getStore();
    const entry = store.getContent(id);
    if (!entry) {
      return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
    }
    if (!flameConfigured()) {
      return NextResponse.json(
        {
          error:
            "Flame non configuré : ajoute FLAME_API_KEY dans ~/.config/torch/torch.env",
        },
        { status: 503 },
      );
    }
    if (entry.fm["flame-review-url"]) {
      return NextResponse.json({
        ...entry.fm,
        body: entry.body,
        mtimeMs: entry.mtimeMs,
      });
    }

    try {
      // Arborescence Torch › <Format> › <fiche> — mêmes noms de dossiers que
      // dans le vault, pour s'y retrouver d'un outil à l'autre.
      const project = await ensureProject();
      const formatFolder = await ensureFolder(
        project.id,
        FORMAT_DIRS[entry.fm.format],
      );
      const folder = await ensureFolder(project.id, id, formatFolder.id);
      const link = await createShareLink(folder.id, entry.fm.title);
      const patched = await store.patchContent(id, {
        fm: {
          "flame-project": project.id,
          "flame-folder": folder.id,
          "flame-review-url": link.url ?? null,
          "edit-status":
            entry.fm["edit-status"] === "none" ? "editing" : entry.fm["edit-status"],
        },
      });
      return NextResponse.json({
        ...patched.fm,
        body: patched.body,
        mtimeMs: patched.mtimeMs,
      });
    } catch (err) {
      const message =
        err instanceof FlameError
          ? err.message
          : `Flame injoignable : ${err instanceof Error ? err.message : String(err)}`;
      return NextResponse.json({ error: message }, { status: 502 });
    }
  });
}
