import { NextResponse } from "next/server";
import { pgPool } from "@/lib/postgres";

export async function GET() {
  try {
    const result = await pgPool.query("select 1 as ok");
    return NextResponse.json(
      {
        status: "ok",
        db: "postgres",
        result: result.rows?.[0]?.ok ?? 1,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        db: "postgres",
        message: error.message || "Postgres health check failed",
      },
      { status: 500 }
    );
  }
}
