import { NextRequest, NextResponse } from "next/server";
import { RateLimiterMemory } from "rate-limiter-flexible";

// Simple in-memory limiter (good for single-instance / development)
const limiter = new RateLimiterMemory({ points: 60, duration: 60 });

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) return ip;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function applyRateLimit(
  request: NextRequest,
  points = 1
): Promise<NextResponse | null> {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }
  const key = getClientIp(request);
  try {
    await limiter.consume(key, points);
    return null;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: "Too many requests. Please wait and try again.",
        error: "Rate Limited",
      },
      { status: 429 }
    );
  }
}
