import { NextRequest, NextResponse } from "next/server";
import { getCustomSession } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await getCustomSession();
    
    if (!session || !session.accessToken) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    
    // Test with the problem playlist
    const playlistId = "6lf0FyFnEoN7THbDebLJ8R";
    
    // Import and use the route handler directly
    const { POST } = await import("../transfer-v2/route");
    
    // Create a mock request for the route handler
    const mockRequest = new NextRequest(new URL(`${request.nextUrl.origin}/api/transfer-v2`), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.accessToken}`
      },
      body: JSON.stringify({ playlistId })
    });
    
    const response = await POST(mockRequest);
    
    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: "Transfer failed", details: error },
        { status: response.status }
      );
    }
    
    const result = await response.json();
    
    // Create a detailed comparison report
    const report = {
      summary: {
        playlist: result.playlistName,
        total: result.totalTracks,
        successful: result.successfulTransfers,
        failed: result.failures.length,
        successRate: `${((result.successfulTransfers / result.totalTracks) * 100).toFixed(1)}%`,
      },
      
      // Show what matched successfully
      successfulMatches: result.successful?.map((s: any) => ({
        spotify: {
          name: s.spotifyTrack.name,
          artist: s.spotifyTrack.artists.map((a: any) => a.name).join(", "),
          album: s.spotifyTrack.album.name,
          duration: Math.floor(s.spotifyTrack.duration_ms / 1000),
          releaseDate: s.spotifyTrack.album.release_date,
        },
        apple: {
          name: s.appleTrack.name,
          artist: s.appleTrack.artistName,
          album: s.appleTrack.albumName,
          duration: Math.floor(s.appleTrack.durationMillis / 1000),
          releaseDate: s.appleTrack.releaseDate?.split('T')[0],
        },
        matchQuality: {
          exactName: s.spotifyTrack.name === s.appleTrack.name,
          exactArtist: s.spotifyTrack.artists[0].name === s.appleTrack.artistName,
          durationDiff: Math.abs(s.spotifyTrack.duration_ms - s.appleTrack.durationMillis) / 1000,
        }
      })),
      
      // Show what failed and why
      failures: result.failures?.map((f: any) => ({
        track: {
          name: f.spotifyTrack.name,
          artist: f.spotifyTrack.artists.map((a: any) => a.name).join(", "),
          album: f.spotifyTrack.album.name,
        },
        reason: f.reason,
        possibleMatches: f.possibleMatches?.length || 0,
        topMatch: f.possibleMatches?.[0] ? {
          name: f.possibleMatches[0].name,
          artist: f.possibleMatches[0].artistName,
          album: f.possibleMatches[0].albumName,
        } : null,
      })),
    };
    
    return NextResponse.json(report);
  } catch (error) {
    console.error("Test transfer error:", error);
    return NextResponse.json(
      { error: "Test failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}