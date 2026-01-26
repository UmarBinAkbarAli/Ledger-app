/**
 * Test endpoint to verify SSL and Firebase Admin are working
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Set SSL bypass
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
