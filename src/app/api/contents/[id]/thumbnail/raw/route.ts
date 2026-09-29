import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/vault/store";
import { resolveAssetPath } from "@/lib/vault/assets";
import { slugifyTitle } from "@/lib/vault/slug";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * GET : sert l'image de silex-assets (hors public/, donc pas servie en statique).
 * `?download=1` la propose en téléchargement, nommée d'après le titre de la
 * fiche — sinon le navigateur l'enregistrerait sous « raw ».
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const store = await getStore();
  const entry = store.getContent(id);
  const relative = entry?.fm.thumbnail;
  if (!relative) return new NextResponse(null, { status: 404 });

  const abs = resolveAssetPath(relative);
  if (!abs) return new NextResponse(null, { status: 400 });

  try {
    const file = await fs.readFile(abs);
    const stat = await fs.stat(abs);
    const ext = path.extname(abs).toLowerCase();
    const headers: Record<string, string> = {
      "Content-Type": MIME[ext] ?? "image/png",
      // Le nom de fichier ne change pas d'une génération à l'autre : on
      // révalide à chaque fois pour ne pas afficher l'ancienne vignette.
      "Cache-Control": "no-store",
      ETag: `"${stat.mtimeMs}"`,
    };
    if (req.nextUrl.searchParams.get("download")) {
      // Nom ASCII : le titre peut contenir accents, deux-points, guillemets.
      headers["Content-Disposition"] =
        `attachment; filename="${slugifyTitle(entry.fm.title)}${ext}"`;
    }
    return new NextResponse(new Uint8Array(file), { headers });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
