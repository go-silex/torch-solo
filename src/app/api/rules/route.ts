import { NextRequest, NextResponse } from "next/server";
import { runWithOperator } from "@/lib/operator";
import { getRules, saveRules } from "@/lib/services/rules";
import { RulesInputSchema } from "@/lib/types/rules";

export const dynamic = "force-dynamic";

/** GET : règles éditoriales (_Config/Rules.md). */
export async function GET() {
  return NextResponse.json(await getRules());
}

export async function PUT(req: NextRequest) {
  return runWithOperator(req, async () => {
    const json = await req.json().catch(() => null);
    const parsed = RulesInputSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    return NextResponse.json(await saveRules(parsed.data));
  });
}
