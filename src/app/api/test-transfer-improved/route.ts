import { NextRequest, NextResponse } from "next/server";
import { getCustomSession } from "@/lib/auth-utils";
import fs from "fs/promises";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    const session = await getCustomSession();
    
    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    
    // Test the transfer with the same playlist
    const playlistId = "6lf0FyFnEoN7THbDebLJ8R";
    
    const response = await fetch(`${request.nextUrl.origin}/api/transfer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.accessToken}`
      },
      body: JSON.stringify({ playlistId })
    });
    
    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: "Transfer failed", details: error },
        { status: response.status }
      );
    }
    
    const result = await response.json();
    
    // Save the result to file
    const filePath = path.join(process.cwd(), "transfer-result-improved.json");
    await fs.writeFile(filePath, JSON.stringify(result, null, 2));
    
    // Load old result for comparison if it exists
    let comparison = null;
    try {
      const oldPath = path.join(process.cwd(), "test-transfer.json");
      const oldData = await fs.readFile(oldPath, "utf8");
      const oldResult = JSON.parse(oldData);
      
      comparison = {
        previousSuccessful: oldResult.successfulTransfers,
        currentSuccessful: result.successfulTransfers,
        improvement: result.successfulTransfers - oldResult.successfulTransfers,
        previousFailures: oldResult.failures.map((f: any) => f.spotifyTrack.name),
        currentFailures: result.failures.map((f: any) => f.spotifyTrack.name),
      };
      
      // Find newly successful tracks
      comparison.newlySuccessful = comparison.previousFailures.filter(
        (name: string) => !comparison.currentFailures.includes(name)
      );
    } catch (e) {
      // Old file doesn't exist, that's okay
    }
    
    return NextResponse.json({
      message: "Transfer test completed",
      result: {
        playlistName: result.playlistName,
        totalTracks: result.totalTracks,
        successfulTransfers: result.successfulTransfers,
        failures: result.failures.length,
      },
      comparison,
      savedTo: "transfer-result-improved.json"
    });
  } catch (error) {
    console.error("Test transfer error:", error);
    return NextResponse.json(
      { error: "Test failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}