import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { THUMBNAILS_DIR, getAssetsRoot } from "@/lib/config";
import { runWithOperator } from "@/lib/operator";
import { getStore } from "@/lib/vault/store";
import { resolveAssetPath } from "@/lib/vault/assets";
import {
  RockyError,
  decodeDataUrl,
  formatIdFor,
  generateIllustration,
  rockyConfigured,
  topicFor,
} from "@/lib/services/rocky-client";

export const dynamic = "force-dynamic";
/** Une génération Rocky prend ~1 min ; on laisse large. */
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

/** POST : génère la vignette via Rocky et l'écrit dans silex-assets. */
export async function POST(req: NextRequest, { params }: Params) {
  return runWithOperator(req, async () => {
    const { id } = await params;
    const store = await getStore();
    const entry = store.getContent(id);
    if (!entry) {
      return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
    }
    if (!rockyConfigured()) {
      return NextResponse.json(
        {
          error:
            "Rocky non configuré : ajoute ROCKY_PASSWORD dans ~/.config/torch/torch.env",
        },
        { status: 503 },
      );
    }
    const assetsRoot = getAssetsRoot();
    if (!assetsRoot) {
      return NextResponse.json(
        {
          error:
            "Drive silex-assets introuvable — vérifie qu'il est synchronisé, ou " +
            "renseigne TORCH_ASSETS_ROOT dans ~/.config/torch/torch.env",
        },
        { status: 503 },
      );
    }

    try {
      const topic = topicFor(entry.fm, entry.body);
      const image = await generateIllustration(topic, formatIdFor(entry.fm));
      const { buffer, ext } = decodeDataUrl(image.dataUrl);

      const dir = path.join(assetsRoot, THUMBNAILS_DIR);
      await fs.mkdir(dir, { recursive: true });
      const absPath = path.join(dir, `${id}.${ext}`);
      // Écriture atomique : le Drive ne doit jamais voir un PNG à moitié écrit.
      const tmp = path.join(dir, `.${id}.${ext}.tmp`);
      await fs.writeFile(tmp, buffer);
      await fs.rename(tmp, absPath);

      // Une image importée à la main peut avoir une autre extension : la retirer.
      const previous = entry.fm.thumbnail ? resolveAssetPath(entry.fm.thumbnail) : null;
      if (previous && previous !== absPath) await fs.rm(previous, { force: true });

      const patched = await store.patchContent(id, {
        fm: {
          thumbnail: path.relative(assetsRoot, absPath),
          "thumbnail-asset": image.assetId,
        },
      });
      return NextResponse.json({
        ...patched.fm,
        body: patched.body,
        mtimeMs: patched.mtimeMs,
      });
    } catch (err) {
      const message =
        err instanceof RockyError
          ? err.message
          : `Rocky injoignable : ${err instanceof Error ? err.message : String(err)}`;
      return NextResponse.json({ error: message }, { status: 502 });
    }
  });
}

/** DELETE : retire la vignette de la fiche et supprime le fichier de silex-assets. */
export async function DELETE(req: NextRequest, { params }: Params) {
  return runWithOperator(req, async () => {
    const { id } = await params;
    const store = await getStore();
    const entry = store.getContent(id);
    if (!entry) {
      return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
    }
    const relative = entry.fm.thumbnail;
    if (!relative) {
      return NextResponse.json({ error: "Aucune vignette" }, { status: 400 });
    }
    const abs = resolveAssetPath(relative);
    if (abs) await fs.rm(abs, { force: true });
    const patched = await store.patchContent(id, {
      fm: { thumbnail: null, "thumbnail-asset": null },
    });
    return NextResponse.json({
      ...patched.fm,
      body: patched.body,
      mtimeMs: patched.mtimeMs,
    });
  });
}
