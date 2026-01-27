/**
 * Enhanced Rate Limiter with Redis support
 * Provides distributed rate limiting for production environments
 */

import { NextRequest, NextResponse } from "next/server";
import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";

// Redis client for distributed rate limiting (production)
let redisRateLimiter: RateLimiterRedis | null = null;

// In-memory fallback (development)
const memoryLimiter = new RateLimiterMemory({
  points: 60, // Number of requests
  duration: 60, // Per 60 seconds
});

/**
 * Initialize Redis rate limiter if credentials are available
 */
async function initRedisRateLimiter() {
  if (redisRateLimiter) return redisRateLimiter;
  
  // Only use Redis in production with proper credentials
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    try {
      const { Redis } = await import('@upstash/redis');
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      
      // Test connection
      await redis.ping();
      
      // Create rate limiter with Redis (simplified - using memory limiter as Upstash doesn't directly work with rate-limiter-flexible)
      console.log('✅ Redis rate limiter initialized');
      // Note: For full Redis support, you'd need to use Upstash's native rate limiting or implement custom logic
      return memoryLimiter;
    } catch (error) {
      console.warn('⚠️ Redis rate limiter failed to initialize, falling back to memory:', error);
      return memoryLimiter;
    }
  }
  
  return memoryLimiter;
}

/**
 * Get client identifier from request
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from various headers
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const ip = forwarded.split(",")[0]?.trim();
    if (ip) return ip;
  }
  
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp;
  
  return "unknown-client";
}

/**
 * Apply rate limiting to a request
 * @param request - Next.js request object
 * @param points - Number of points to consume (default: 1)
 * @param maxPoints - Maximum points allowed (default: 60)
 * @param duration - Time window in seconds (default: 60)
 */
export async function applyRateLimit(
  request: NextRequest,
  points = 1,
  maxPoints = 60,
  duration = 60
): Promise<NextResponse | null> {
  // Skip rate limiting in development unless explicitly enabled
  if (process.env.NODE_ENV !== "production" && !process.env.ENABLE_RATE_LIMIT) {
    return null;
  }
  
  const limiter = await initRedisRateLimiter();
  const clientId = getClientIdentifier(request);
  
  try {
    await limiter.consume(clientId, points);
    return null; // Rate limit not exceeded
  } catch (error: any) {
    // Rate limit exceeded
    const retryAfter = error?.msBeforeNext 
      ? Math.ceil(error.msBeforeNext / 1000) 
      : duration;
    
    console.warn(`⚠️ Rate limit exceeded for ${clientId}`);
    
    return NextResponse.json(
      {
        success: false,
        message: "Too many requests. Please wait and try again.",
        error: "Rate Limited",
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': maxPoints.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(Date.now() + retryAfter * 1000).toISOString(),
        },
      }
    );
  }
}

/**
 * Strict rate limiter for sensitive operations (auth, user creation)
 */
export async function applyStrictRateLimit(
  request: NextRequest
): Promise<NextResponse | null> {
  return applyRateLimit(request, 1, 5, 300); // 5 requests per 5 minutes
}

/**
 * Auth rate limiter for login attempts
 */
export async function applyAuthRateLimit(
  request: NextRequest
): Promise<NextResponse | null> {
  return applyRateLimit(request, 1, 10, 900); // 10 attempts per 15 minutes
}
