import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "LIVE", timestamp: new Date().toISOString() });
}
