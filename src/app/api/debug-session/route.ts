import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCustomSession } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    // Check cookies
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session-token");
    
    // Try to get session
    const session = await getCustomSession();
    
    return NextResponse.json({
      hasCookie: !!sessionCookie,
      cookieValue: sessionCookie ? sessionCookie.value.substring(0, 20) + "..." : null,
      hasSession: !!session,
      sessionData: session ? {
        hasAccessToken: !!session.accessToken,
        hasToken: !!session.accessToken,
        expiresAt: session.expiresAt,
      } : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      error: "Debug failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}