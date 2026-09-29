import { NextRequest, NextResponse } from "next/server";
import { runWithOperator } from "@/lib/operator";
import { ThemeOverlapError, createTheme, listThemes } from "@/lib/services/themes";
import { ThemeInputSchema } from "@/lib/types/theme";

export const dynamic = "force-dynamic";

/** GET : thèmes éditoriaux (_Config/Themes.md). */
export async function GET() {
  return NextResponse.json({ themes: await listThemes() });
}

export async function POST(req: NextRequest) {
  return runWithOperator(req, async () => {
    const json = await req.json().catch(() => null);
    const parsed = ThemeInputSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    try {
      const theme = await createTheme(parsed.data);
      return NextResponse.json(theme, { status: 201 });
    } catch (err) {
      if (err instanceof ThemeOverlapError) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      throw err;
    }
  });
}
