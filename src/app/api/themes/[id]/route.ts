import { NextRequest, NextResponse } from "next/server";
import { runWithOperator } from "@/lib/operator";
import {
  ThemeNotFoundError,
  ThemeOverlapError,
  deleteTheme,
  updateTheme,
} from "@/lib/services/themes";
import { ThemeInputSchema } from "@/lib/types/theme";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  return runWithOperator(req, async () => {
    const { id } = await params;
    const json = await req.json().catch(() => null);
    const parsed = ThemeInputSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    try {
      return NextResponse.json(await updateTheme(id, parsed.data));
    } catch (err) {
      if (err instanceof ThemeNotFoundError) {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      if (err instanceof ThemeOverlapError) {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      throw err;
    }
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  return runWithOperator(req, async () => {
    const { id } = await params;
    try {
      await deleteTheme(id);
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      if (err instanceof ThemeNotFoundError) {
        return NextResponse.json({ error: err.message }, { status: 404 });
      }
      throw err;
    }
  });
}
