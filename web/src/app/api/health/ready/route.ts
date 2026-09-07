import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";

export async function GET() {
  try {
    await connectDB();
    return NextResponse.json({ status: "READY", database: "connected", timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { status: "UNAVAILABLE", database: "disconnected", timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
