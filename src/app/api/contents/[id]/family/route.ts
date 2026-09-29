import { NextRequest, NextResponse } from "next/server";
import { runWithOperator } from "@/lib/operator";
import { getStore } from "@/lib/vault/store";
import {
  buildFamily,
  derivativesToCreate,
  getTargets,
} from "@/lib/services/waterfall";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const store = await getStore();
  const parent = store.getContent(id);
  if (!parent) {
    return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
  }
  const targets = await getTargets();
  const children = store.listContents({ derivedFrom: id });
  const family = buildFamily(children, targets["waterfall-expected"]);
  return NextResponse.json({ family });
}

/** POST : crée les dérivés manquants (statut idea) selon waterfall-expected. */
export async function POST(req: NextRequest, { params }: Params) {
  return runWithOperator(req, async () => {
    const { id } = await params;
    const store = await getStore();
    const parent = store.getContent(id);
    if (!parent) {
      return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });
    }
    if (parent.fm.format !== "episode") {
      return NextResponse.json(
        { error: "Seuls les épisodes ont un waterfall de dérivés" },
        { status: 400 },
      );
    }
    const targets = await getTargets();
    const existing = store.listContents({ derivedFrom: id });
    const toCreate = derivativesToCreate(
      parent.fm.title,
      existing,
      targets["waterfall-expected"],
    );
    const created = [];
    for (const d of toCreate) {
      created.push(
        await store.createContent({
          title: d.title,
          format: d.format,
          emitter: parent.fm.emitter,
          ...(parent.fm.sel ? { sel: parent.fm.sel } : {}),
          pillar: parent.fm.pillar,
          status: "idea",
          "derived-from": id,
        }),
      );
    }
    return NextResponse.json(
      { created: created.map((c) => c.fm.id) },
      { status: 201 },
    );
  });
}
