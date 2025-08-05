import { NextRequest, NextResponse } from "next/server";
import SpotifyWebApi from "spotify-web-api-node";
import { z } from "zod";
import { TransferResult, TransferFailure, SuccessfulTransfer, SpotifyTrack, AppleTrack } from "@/types/transfer";
import { matchTracks } from "@/lib/track-matching-algorithm";

const requestSchema = z.object({
  playlistId: z.string().regex(/^[a-zA-Z0-9]+$/),
});

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

async function searchAppleMusic(track: SpotifyTrack): Promise<AppleTrack[]> {
  console.log('\n' + '='.repeat(80));
  console.log(`SEARCHING FOR: "${track.name}" by ${track.artists.map(a => a.name).join(", ")}`);
  console.log(`Album: "${track.album.name}"`);
  console.log(`Duration: ${track.duration_ms}ms (${Math.floor(track.duration_ms/1000)}s)`);
  console.log('='.repeat(80));

  try {
    if (!process.env.ITUNES_API_URL) {
      console.error("ITUNES_API_URL environment variable is not set!");
      return [];
    }

    // Build search query - try multiple variations
    const searchQueries = [
      // Try exact match first
      `${track.name} ${track.artists.map(a => a.name).join(" ")}`,
      // Try with album
      `${track.name} ${track.artists[0].name} ${track.album.name}`,
      // Try just track and primary artist
      `${track.name} ${track.artists[0].name}`,
      // Try without parentheses content (for remixes)
      (() => {
        const cleanName = track.name.replace(/\s*\(.*?\)\s*/g, '').trim();
        return cleanName !== track.name ? `${cleanName} ${track.artists[0].name}` : null;
      })(),
      // Try just artist name + exact track name in quotes
      `"${track.name}" ${track.artists[0].name}`,
    ].filter(q => q !== null) as string[];

    const allMatches: AppleTrack[] = [];
    
    for (const searchQuery of searchQueries) {
      const searchUrl = `${process.env.ITUNES_API_URL}?term=${encodeURIComponent(searchQuery)}&entity=song&limit=50`;
      
      console.log(`\nTrying search #${searchQueries.indexOf(searchQuery) + 1}: "${searchQuery}"`);
      
      try {
        const response = await fetch(searchUrl);
        if (!response.ok) {
          console.log(`  ❌ Search failed with status ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        console.log(`  ✓ Found ${data.resultCount} results`);
        
        if (data.results && data.results.length > 0) {
          const matches = data.results.map((r: any) => ({
            id: r.trackId?.toString() || '',
            name: r.trackName || '',
            artistName: r.artistName || '',
            albumName: r.collectionName || '',
            url: r.trackViewUrl || '',
            durationMillis: r.trackTimeMillis || 0,
            artworkUrl: r.artworkUrl100?.replace('100x100', '600x600') || r.artworkUrl100 || r.artworkUrl60,
            releaseDate: r.releaseDate || r.collectionReleaseDate || '',
          }));
          
          // Log first few results
          console.log('  Top results:');
          matches.slice(0, 3).forEach((m, idx) => {
            const durationDiff = Math.abs(m.durationMillis - track.duration_ms);
            console.log(`    ${idx + 1}. "${m.name}" by ${m.artistName}`);
            console.log(`       Album: ${m.albumName}`);
            console.log(`       Duration: ${Math.floor(m.durationMillis/1000)}s (diff: ${Math.floor(durationDiff/1000)}s)`);
          });
          
          // Add unique matches only
          let addedCount = 0;
          for (const match of matches) {
            if (!allMatches.some(m => m.id === match.id)) {
              allMatches.push(match);
              addedCount++;
            }
          }
          console.log(`  Added ${addedCount} new unique matches (total: ${allMatches.length})`);
        }
      } catch (error) {
        console.error("  ❌ Search error:", error);
      }
      
      // Stop if we have enough good matches
      if (allMatches.length >= 20) {
        console.log(`  Stopping search - have ${allMatches.length} matches`);
        break;
      }
    }
    
    console.log(`\nFINAL: Found ${allMatches.length} total unique matches`);
    return allMatches;
  } catch (error) {
    console.error("Apple Music search error:", error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get access token from Authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Not authenticated", details: "No access token provided" },
        { status: 401 }
      );
    }
    
    const accessToken = authHeader.split(" ")[1];

    const body = await request.json();
    const { playlistId } = requestSchema.parse(body);

    spotifyApi.setAccessToken(accessToken);

    // Get playlist details
    const playlist = await spotifyApi.getPlaylist(playlistId);
    const tracks: SpotifyTrack[] = [];
    
    // Handle pagination for large playlists
    let offset = 0;
    const limit = 100;
    
    while (offset < playlist.body.tracks.total) {
      const response = await spotifyApi.getPlaylistTracks(playlistId, {
        offset,
        limit,
      });
      
      const validTracks = response.body.items
        .filter(item => item.track && item.track.type === "track")
        .map(item => item.track as SpotifyApi.TrackObjectFull);
      
      tracks.push(...validTracks);
      offset += limit;
    }

    // Process transfers
    const failures: TransferFailure[] = [];
    const successful: SuccessfulTransfer[] = [];

    for (const track of tracks) {
      const appleMatches = await searchAppleMusic(track);
      
      // Use the research-based matching algorithm
      const matchResult = matchTracks(track, appleMatches);
      
      console.log(`\nMATCHING RESULT for "${track.name}":`);
      console.log(`  Best match: ${matchResult.bestMatch ? `"${matchResult.bestMatch.name}" by ${matchResult.bestMatch.artistName}` : 'None'}`);
      console.log(`  Confidence: ${matchResult.confidence}`);
      
      if (matchResult.allScores.length > 0) {
        console.log(`  Top 3 scores:`);
        matchResult.allScores.slice(0, 3).forEach((s, idx) => {
          console.log(`    ${idx + 1}. Score: ${(s.totalScore * 100).toFixed(1)}% - "${s.track.name}" by ${s.track.artistName}`);
          console.log(`       Title: ${(s.breakdown.titleSimilarity * 100).toFixed(0)}%, Artist: ${(s.breakdown.artistSimilarity * 100).toFixed(0)}%, Album: ${(s.breakdown.albumSimilarity * 100).toFixed(0)}%, Duration: ${(s.breakdown.durationSimilarity * 100).toFixed(0)}%`);
        });
      }
      
      if (matchResult.bestMatch && matchResult.confidence !== 'none') {
        // Successful match
        successful.push({
          spotifyTrack: track,
          appleTrack: matchResult.bestMatch,
        });
        
        console.log(`  ✓ AUTO-SELECTED with ${matchResult.confidence} confidence`);
      } else {
        // Failed to match
        const topMatches = matchResult.allScores.slice(0, 5);
        
        const failure: TransferFailure = {
          spotifyTrack: track,
          reason: appleMatches.length === 0 ? "not_found" : "multiple_matches",
          details: matchResult.reason || getFailureDetails(appleMatches.length === 0 ? "not_found" : "multiple_matches", track),
          suggestedAction: getSuggestedAction(appleMatches.length === 0 ? "not_found" : "multiple_matches", track),
          possibleMatches: topMatches.map(s => s.track),
        };
        
        console.log(`  ✗ NOT AUTO-SELECTED - ${matchResult.reason || 'confidence too low'}`);
        
        failures.push(failure);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const result: TransferResult = {
      playlistName: playlist.body.name,
      totalTracks: tracks.length,
      successfulTransfers: successful.length,
      successful,
      failures,
      transferDate: new Date().toISOString(),
      spotifyPlaylistUrl: playlist.body.external_urls.spotify,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Transfer error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Transfer failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function getFailureDetails(reason: TransferFailure["reason"], track: SpotifyTrack): string {
  switch (reason) {
    case "not_found":
      return `The track "${track.name}" by ${track.artists.map(a => a.name).join(", ")} could not be found in the Apple Music catalog.`;
    case "region_locked":
      return `This track appears to be region-locked and is not available in your Apple Music region.`;
    case "multiple_matches":
      return `Multiple potential matches were found, but none had high enough confidence for automatic selection.`;
    case "api_error":
      return `An error occurred while searching for this track in Apple Music.`;
  }
}

function getSuggestedAction(reason: TransferFailure["reason"], track: SpotifyTrack): string {
  switch (reason) {
    case "not_found":
      return "Try searching manually in Apple Music using variations of the track name or artist.";
    case "region_locked":
      return "This track may be available under a different name or artist in your region.";
    case "multiple_matches":
      return "Review the possible matches below and manually add the correct version to your Apple Music playlist.";
    case "api_error":
      return "Try again later or search for this track manually in Apple Music.";
  }
}