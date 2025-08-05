import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCustomSession } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    // Check cookies
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("session-token");
    
    // Try to get session
    const session = await getCustomSession();
    
    return NextResponse.json({
      hasCookie: !!sessionCookie,
      cookieValue: sessionCookie ? sessionCookie.value.substring(0, 20) + "..." : null,
      hasSession: !!session,
      sessionData: session ? {
        hasAccessToken: !!session.accessToken,
        tokenPreview: session.accessToken ? session.accessToken.substring(0, 20) + "..." : null,
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