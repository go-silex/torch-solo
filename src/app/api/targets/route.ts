import { NextResponse } from "next/server";
import { getTargets } from "@/lib/services/waterfall";

export const dynamic = "force-dynamic";

/** GET : objectifs de cadence (_Config/Targets.md), lecture seule. */
export async function GET() {
  return NextResponse.json(await getTargets());
}
