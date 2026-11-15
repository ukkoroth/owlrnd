import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: "up" });
  } catch (err) {
    console.error("[owlrnd health] database check failed", err);
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
