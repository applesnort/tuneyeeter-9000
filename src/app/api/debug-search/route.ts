import { NextRequest, NextResponse } from "next/server";
import { getCustomSession } from "@/lib/auth-utils";
import SpotifyWebApi from "spotify-web-api-node";

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

async function searchAppleMusic(query: string) {
  if (!process.env.ITUNES_API_URL) {
    return { error: "ITUNES_API_URL not set" };
  }

  const searchUrl = `${process.env.ITUNES_API_URL}?term=${encodeURIComponent(query)}&entity=song&limit=50`;
  
  try {
    const response = await fetch(searchUrl);
    if (!response.ok) {
      return { error: `Search failed: ${response.status}` };
    }
    
    const data = await response.json();
    return {
      query,
      resultCount: data.resultCount,
      results: data.results?.map((r: any) => ({
        name: r.trackName,
        artist: r.artistName,
        album: r.collectionName,
        duration: Math.floor((r.trackTimeMillis || 0) / 1000),
        releaseDate: r.releaseDate || r.collectionReleaseDate,
      }))
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getCustomSession();
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    spotifyApi.setAccessToken(session.accessToken);

    // Get the test playlist
    const playlistId = "6ZqKAo7ECLlFSwOX278S8V";
    const playlist = await spotifyApi.getPlaylist(playlistId);
    
    const debugResults = [];
    
    // Get all tracks
    const tracks = playlist.body.tracks.items
      .filter(item => item.track && item.track.type === "track")
      .map(item => item.track as SpotifyApi.TrackObjectFull);
    
    // For each track, try different search strategies
    for (const track of tracks) {
      const trackInfo = {
        spotify: {
          name: track.name,
          artists: track.artists.map(a => a.name),
          album: track.album.name,
          duration: Math.floor(track.duration_ms / 1000),
          releaseDate: track.album.release_date,
        },
        searches: [] as any[],
      };
      
      // Search strategies
      const searchQueries = [
        // 1. Full track + all artists
        `${track.name} ${track.artists.map(a => a.name).join(" ")}`,
        
        // 2. Track + primary artist only
        `${track.name} ${track.artists[0].name}`,
        
        // 3. Track + primary artist + album
        `${track.name} ${track.artists[0].name} ${track.album.name}`,
        
        // 4. Clean track name (no remix info) + primary artist
        (() => {
          const cleanName = track.name
            .replace(/\s*\(.*?\)\s*/g, '')
            .replace(/\s*\[.*?\]\s*/g, '')
            .replace(/\s*-\s*.*$/g, '')
            .trim();
          return `${cleanName} ${track.artists[0].name}`;
        })(),
        
        // 5. Just the exact track name
        track.name,
        
        // 6. Artist + album
        `${track.artists[0].name} ${track.album.name}`,
      ];
      
      // Remove duplicates
      const uniqueQueries = [...new Set(searchQueries)];
      
      for (const query of uniqueQueries) {
        const result = await searchAppleMusic(query);
        trackInfo.searches.push(result);
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      debugResults.push(trackInfo);
    }
    
    return NextResponse.json({
      playlist: playlist.body.name,
      totalTracks: tracks.length,
      debugResults,
    });
  } catch (error) {
    console.error("Debug search error:", error);
    return NextResponse.json(
      { error: "Debug failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}