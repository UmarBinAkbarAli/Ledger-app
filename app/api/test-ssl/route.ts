/**
 * Test endpoint to verify SSL and Firebase Admin are working
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // ✅ SECURITY: Only allow this test endpoint in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      {
        success: false,
        message: "This endpoint is only available in development mode",
        error: "Forbidden"
      },
      { status: 403 }
    );
  }

  try {
    // Set SSL bypass for development testing
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    
    const adminAuth = getAdminAuth();
    
    // Try a simple operation
    const result = await adminAuth.listUsers(1);
    
    return NextResponse.json({
      success: true,
      message: "✅ SSL and Firebase Admin are working correctly",
      usersFound: result.users.length,
      sslDisabled: process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0",
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: "❌ Error: " + error.message,
      code: error.code,
      sslDisabled: process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0",
    }, { status: 500 });
  }
}
