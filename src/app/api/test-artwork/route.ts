import { NextRequest, NextResponse } from "next/server";
import { getCustomSession } from "@/lib/auth-utils";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  try {
    const session = await getCustomSession();
    
    if (!session) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Fetch first track from playlist
    const playlistResponse = await fetch(
      `https://api.spotify.com/v1/playlists/6lf0FyFnEoN7THbDebLJ8R/tracks?limit=1`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    if (!playlistResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch playlist" },
        { status: 500 }
      );
    }

    const playlistData = await playlistResponse.json();
    const spotifyTrack = playlistData.items[0]?.track;

    if (!spotifyTrack) {
      return NextResponse.json(
        { error: "No tracks in playlist" },
        { status: 404 }
      );
    }

    // Search Apple Music
    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(
      spotifyTrack.name + " " + spotifyTrack.artists[0].name
    )}&entity=song&limit=5`;
    
    const appleResponse = await fetch(searchUrl);
    const appleData = await appleResponse.json();
    const appleTrack = appleData.results?.[0];

    if (!appleTrack) {
      return NextResponse.json({
        spotifyTrack: {
          name: spotifyTrack.name,
          artist: spotifyTrack.artists[0].name,
          album: spotifyTrack.album.name,
          artwork: spotifyTrack.album.images?.[0]?.url,
        },
        appleTrack: null,
        comparison: null,
      });
    }

    // Get artwork URLs
    const spotifyArtUrl = spotifyTrack.album.images?.[0]?.url;
    const appleArtUrl = appleTrack.artworkUrl100?.replace('100x100', '600x600');

    let comparisonResult = null;
    if (spotifyArtUrl && appleArtUrl) {
      try {
        const scriptPath = path.join(process.cwd(), 'scripts', 'compare_artwork.py');
        const inputData = JSON.stringify({ url1: spotifyArtUrl, url2: appleArtUrl });
        
        const { stdout } = await execAsync(
          `echo '${inputData.replace(/'/g, "'\\''")}' | python3 "${scriptPath}"`,
          {
            encoding: 'utf8',
            timeout: 10000 // 10 second timeout
          }
        );
        
        comparisonResult = JSON.parse(stdout);
      } catch (error) {
        console.error("Comparison error:", error);
        comparisonResult = { error: "Failed to compare images" };
      }
    }

    return NextResponse.json({
      spotifyTrack: {
        name: spotifyTrack.name,
        artist: spotifyTrack.artists.map((a: any) => a.name).join(", "),
        album: spotifyTrack.album.name,
        artwork: spotifyArtUrl,
      },
      appleTrack: {
        name: appleTrack.trackName,
        artist: appleTrack.artistName,
        album: appleTrack.collectionName,
        artwork: appleArtUrl,
      },
      comparison: comparisonResult,
    });
    
  } catch (error) {
    console.error("Test artwork error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}