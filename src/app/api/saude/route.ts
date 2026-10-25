import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  await sql`select 1`;
  return NextResponse.json({ ok: true });
}
