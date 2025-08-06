import { NextRequest, NextResponse } from "next/server";
import { getCustomSession } from "@/lib/auth-utils";

// Store user selections temporarily (in production, use a database)
const userSelections = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    const session = await getCustomSession();
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { playlistId, selectedMatches, transferResult } = body;

    if (!playlistId || !selectedMatches || !transferResult) {
      return NextResponse.json({ 
        error: "Missing required fields",
        required: ["playlistId", "selectedMatches", "transferResult"]
      }, { status: 400 });
    }

    // Create a unique session key
    const sessionKey = `${session.user?.email || session.user?.id}_${playlistId}`;
    
    // Store the user's selections
    userSelections.set(sessionKey, {
      playlistId,
      selectedMatches,
      transferResult,
      timestamp: new Date().toISOString(),
      userId: session.user?.id,
      userEmail: session.user?.email
    });

    console.log(`Saved match selections for user ${session.user?.email}, playlist ${playlistId}`);
    console.log(`Selected ${Object.keys(selectedMatches).length} manual matches`);

    return NextResponse.json({
      success: true,
      sessionKey,
      matchCount: Object.keys(selectedMatches).length,
      message: "Matches saved successfully"
    });

  } catch (error) {
    console.error("Save matches error:", error);
    return NextResponse.json(
      { error: "Failed to save matches", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getCustomSession();
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const playlistId = searchParams.get('playlistId');

    if (!playlistId) {
      return NextResponse.json({ error: "playlistId required" }, { status: 400 });
    }

    const sessionKey = `${session.user?.email || session.user?.id}_${playlistId}`;
    const savedData = userSelections.get(sessionKey);

    if (!savedData) {
      return NextResponse.json({ error: "No saved matches found" }, { status: 404 });
    }

    return NextResponse.json(savedData);

  } catch (error) {
    console.error("Get matches error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve matches", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}