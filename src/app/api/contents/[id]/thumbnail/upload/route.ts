import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { THUMBNAILS_DIR, getAssetsRoot } from "@/lib/config";
import { runWithOperator } from "@/lib/operator";
import { getStore } from "@/lib/vault/store";
import { resolveAssetPath } from "@/lib/vault/assets";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Types acceptés → extension écrite (servis ensuite par la route raw). */
const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * POST (multipart, champ `file`) : image choisie à la main, en remplacement ou
 * à la place d'une vignette Rocky. Même emplacement que Rocky (silex-assets),
 * même nom de fichier que la fiche.
 */
export async function POST(req: NextRequest, { params }: Params) {
  return runWithOperator(req, async () => {
    const { id } = await params;
    const store = await getStore();
    const entry = store.getContent(id);
    if (!entry) {
      return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
    }
    const assetsRoot = getAssetsRoot();
    if (!assetsRoot) {
      return NextResponse.json(
        {
          error:
            "Drive silex-assets introuvable : vérifie qu'il est synchronisé, ou " +
            "renseigne TORCH_ASSETS_ROOT dans ~/.config/torch/torch.env",
        },
        { status: 503 },
      );
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier reçu" }, { status: 400 });
    }
    const ext = EXTENSIONS[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Format non pris en charge (PNG, JPG, WebP ou GIF)" },
        { status: 415 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image trop lourde (15 Mo max)" }, { status: 413 });
    }

    const dir = path.join(assetsRoot, THUMBNAILS_DIR);
    await fs.mkdir(dir, { recursive: true });
    const absPath = path.join(dir, `${id}.${ext}`);
    // Écriture atomique : le Drive ne doit jamais voir une image à moitié écrite.
    const tmp = path.join(dir, `.${id}.${ext}.tmp`);
    await fs.writeFile(tmp, Buffer.from(await file.arrayBuffer()));
    await fs.rename(tmp, absPath);

    // L'ancienne image avait une autre extension : sans ça elle resterait orpheline.
    const previous = entry.fm.thumbnail ? resolveAssetPath(entry.fm.thumbnail) : null;
    if (previous && previous !== absPath) await fs.rm(previous, { force: true });

    const patched = await store.patchContent(id, {
      fm: {
        thumbnail: path.relative(assetsRoot, absPath),
        "thumbnail-asset": null,
      },
    });
    return NextResponse.json({
      ...patched.fm,
      body: patched.body,
      mtimeMs: patched.mtimeMs,
    });
  });
}
