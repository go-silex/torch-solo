import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runWithOperator } from "@/lib/operator";
import { getStore } from "@/lib/vault/store";
import {
  CATEGORIES,
  EMITTERS,
  FORMATS,
  GOALS,
  PILLARS,
  PLATFORMS,
  SELS,
  STATUSES,
  type ContentFilter,
} from "@/lib/types/content";

export const dynamic = "force-dynamic";

function multi<T extends string>(
  param: string | null,
  allowed: readonly T[],
): T[] | undefined {
  if (!param) return undefined;
  const values = param.split(",").filter((v): v is T => allowed.includes(v as T));
  return values.length ? values : undefined;
}

export async function GET(req: NextRequest) {
  const store = await getStore();
  const sp = req.nextUrl.searchParams;
  const filter: ContentFilter = {
    status: multi(sp.get("status"), STATUSES),
    format: multi(sp.get("format"), FORMATS),
    pillar: multi(sp.get("pillar"), PILLARS),
    category: multi(sp.get("category"), CATEGORIES),
    goal: multi(sp.get("goal"), GOALS),
    sel: multi(sp.get("sel"), SELS),
    emitter: multi(sp.get("emitter"), EMITTERS),
    platform: multi(sp.get("platform"), PLATFORMS),
    derivedFrom: sp.get("derivedFrom") ?? undefined,
    search: sp.get("search") ?? undefined,
  };
  const entries = store.listContents(filter);
  return NextResponse.json({
    contents: entries.map((e) => ({
      ...e.fm,
      mtimeMs: e.mtimeMs,
      obsidianUrl: store.obsidianUrl(e),
    })),
    quarantine: store.listQuarantine(),
  });
}

const CreateSchema = z.object({
  title: z.string().min(1),
  format: z.enum(FORMATS),
  emitter: z.enum(EMITTERS),
  sel: z.enum(SELS).optional(),
  pillar: z.enum(PILLARS).optional(),
  category: z.enum(CATEGORIES).nullable().optional(),
  goals: z.array(z.enum(GOALS)).optional(),
  platforms: z.array(z.enum(PLATFORMS)).optional(),
  status: z.enum(STATUSES).optional(),
  planned: z.string().nullable().optional(),
  "derived-from": z.string().nullable().optional(),
  body: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  return runWithOperator(req, async () => {
    const store = await getStore();
    const json = await req.json().catch(() => null);
    const parsed = CreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const entry = await store.createContent(parsed.data);
    return NextResponse.json(
      { ...entry.fm, mtimeMs: entry.mtimeMs, obsidianUrl: store.obsidianUrl(entry) },
      { status: 201 },
    );
  });
}
