import { NextRequest, NextResponse } from "next/server";
import SpotifyWebApi from "spotify-web-api-node";
import { getCustomSession } from "@/lib/auth-utils";
import { matchTracks } from "@/lib/track-matching-algorithm";

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

// Copy the searchAppleMusic function from transfer-v2 for testing
async function searchAppleMusic(track: any) {
  const startTime = Date.now();
  const searchDetails: Array<{ query: string; duration: number; resultCount: number; status: number; }> = [];
  
  console.log('\n' + '='.repeat(80));
  console.log(`TESTING SINGLE TRACK: "${track.name}" by ${track.artists.map((a: any) => a.name).join(", ")}`);
  console.log('='.repeat(80));

  try {
    if (!process.env.ITUNES_API_URL) {
      console.error("ITUNES_API_URL environment variable is not set!");
      return { matches: [], timing: { totalTime: 0, apiCalls: 0, searchDetails: [] } };
    }

    // Normalize strings for search
    const normalizeForSearch = (str: string) => {
      return str
        .normalize('NFC')
        .replace(/&/g, 'and')
        .replace(/['']/g, "'")
        .replace(/[""]/g, '"')
        .replace(/[–—]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const normalizedTrackName = normalizeForSearch(track.name);
    const normalizedArtistName = normalizeForSearch(track.artists[0].name);

    // Build search query - prioritize artist disambiguation
    const searchQueries = [
      `"${normalizedArtistName}" "${normalizedTrackName}"`,
      `"${normalizedArtistName}"`,
      `"${normalizedTrackName}" ${normalizedArtistName}`,
      (() => {
        const cleanName = normalizedTrackName.replace(/\s*\(.*?\)\s*/g, '').trim();
        return cleanName !== normalizedTrackName && cleanName.length > 2 ? 
          `"${normalizedArtistName}" "${cleanName}"` : null;
      })(),
      `${normalizedArtistName} ${normalizedTrackName}`,
    ].filter(q => q !== null) as string[];

    const allMatches: any[] = [];
    const seenTrackIds = new Set<string>();
    
    for (let i = 0; i < searchQueries.length; i++) {
      const searchQuery = searchQueries[i];
      const searchUrl = `${process.env.ITUNES_API_URL}?term=${encodeURIComponent(searchQuery)}&country=US&entity=song&limit=25`;
      
      console.log(`\nSearch ${i + 1}/${searchQueries.length}: "${searchQuery}"`);
      
      const searchStart = Date.now();
      try {
        const response = await fetch(searchUrl, {
          headers: { 'User-Agent': 'Music-Transfer-App/1.0' },
        });
        
        const searchDuration = Date.now() - searchStart;
        
        if (!response.ok) {
          console.log(`  ❌ Failed with status ${response.status}`);
          searchDetails.push({
            query: searchQuery,
            duration: searchDuration,
            resultCount: 0,
            status: response.status
          });
          continue;
        }

        const data = await response.json();
        console.log(`  ✓ Found ${data.resultCount || 0} results`);
        
        searchDetails.push({
          query: searchQuery,
          duration: searchDuration,
          resultCount: data.resultCount || 0,
          status: response.status
        });
        
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
          matches.slice(0, 5).forEach((m: any, idx: number) => {
            const durationDiff = Math.abs(m.durationMillis - track.duration_ms);
            console.log(`    ${idx + 1}. "${m.name}" by ${m.artistName}`);
            console.log(`       Album: ${m.albumName}`);
            console.log(`       Duration: ${Math.floor(m.durationMillis/1000)}s (diff: ${Math.floor(durationDiff/1000)}s)`);
          });
          
          // Add unique matches only
          let addedCount = 0;
          for (const match of matches) {
            if (!seenTrackIds.has(match.id)) {
              seenTrackIds.add(match.id);
              allMatches.push(match);
              addedCount++;
            }
          }
          console.log(`  Added ${addedCount} new unique matches (total: ${allMatches.length})`);
        }
        
        // Check for early termination
        if (allMatches.length > 0) {
          const perfectMatch = allMatches.find((match: any) => {
            const normalizedAppleTitle = normalizeForSearch(match.name);
            const normalizedSpotifyTitle = normalizeForSearch(track.name);
            const titleMatch = normalizedAppleTitle === normalizedSpotifyTitle;
            
            const normalizedAppleArtist = normalizeForSearch(match.artistName);
            const artistMatch = normalizedAppleArtist === normalizedArtistName;
            
            const durationDiff = Math.abs(parseInt(match.durationMillis?.toString() || '0') - track.duration_ms);
            const durationMatch = durationDiff < 2000;
            
            return titleMatch && artistMatch && durationMatch;
          });
          
          if (perfectMatch) {
            console.log(`  Early termination - found perfect match: "${perfectMatch.name}" by ${perfectMatch.artistName}`);
            break;
          }
        }
        
        if (allMatches.length >= 15) {
          console.log(`  Stopping search - have ${allMatches.length} matches`);
          break;
        }
        
      } catch (error) {
        console.error(`  ❌ Search error:`, error);
        searchDetails.push({
          query: searchQuery,
          duration: Date.now() - searchStart,
          resultCount: 0,
          status: 0
        });
      }
      
      // Rate limiting
      if (i < searchQueries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Faster for testing
      }
    }
    
    const totalTime = Date.now() - startTime;
    console.log(`\nFINAL: Found ${allMatches.length} total unique matches in ${totalTime}ms`);
    
    return {
      matches: allMatches,
      timing: { duration_ms: totalTime, apiCalls: searchDetails.length, searchDetails }
    };
  } catch (error) {
    console.error("Apple Music search error:", error);
    return {
      matches: [],
      timing: { duration_ms: Date.now() - startTime, apiCalls: 0, searchDetails: [] }
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getCustomSession();
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    console.log('Request body:', body);
    const { trackId, trackMetadata } = body;

    let spotifyTrack;

    if (trackMetadata) {
      // Handle unavailable tracks by using provided metadata
      console.log('Testing with track metadata (unavailable on Spotify):', trackMetadata);
      spotifyTrack = trackMetadata;
    } else if (trackId) {
      // Validate trackId format (Spotify track IDs are alphanumeric, 22 characters)
      if (typeof trackId !== 'string' || !/^[a-zA-Z0-9]{22}$/.test(trackId)) {
        console.log('Invalid trackId format:', trackId);
        return NextResponse.json({ 
          error: "Invalid track ID format",
          received: trackId,
          help: "Spotify track IDs should be 22-character alphanumeric strings (e.g., '4iV5W9uYEdYUVa79Axb7Rh')"
        }, { status: 400 });
      }

      spotifyApi.setAccessToken(session.accessToken);

      // Get single track details
      try {
        const track = await spotifyApi.getTrack(trackId);
        spotifyTrack = track.body;
      } catch (error: any) {
        console.error('Spotify API error:', error);
        return NextResponse.json({ 
          error: "Failed to fetch track from Spotify",
          trackId: trackId,
          details: error.message || "Unknown Spotify API error"
        }, { status: 400 });
      }
    } else {
      console.log('Missing trackId or trackMetadata. Body:', JSON.stringify(body));
      return NextResponse.json({ 
        error: "trackId or trackMetadata required", 
        received: body,
        help: "Send POST request with { \"trackId\": \"spotify_track_id\" } or { \"trackMetadata\": {...} }"
      }, { status: 400 });
    }

    // Search Apple Music
    const searchResult = await searchAppleMusic(spotifyTrack);
    
    // Run matching algorithm
    const matchResult = matchTracks(spotifyTrack, searchResult.matches);
    
    console.log(`\nMATCHING RESULT:`);
    console.log(`  Best match: ${matchResult.bestMatch ? `"${matchResult.bestMatch.name}" by ${matchResult.bestMatch.artistName}` : 'None'}`);
    console.log(`  Confidence: ${matchResult.confidence}`);
    
    if (matchResult.allScores.length > 0) {
      console.log(`  Top 3 scores:`);
      matchResult.allScores.slice(0, 3).forEach((s, idx) => {
        console.log(`    ${idx + 1}. Score: ${(s.totalScore * 100).toFixed(1)}% - "${s.track.name}" by ${s.track.artistName}`);
      });
    }

    return NextResponse.json({
      spotifyTrack: {
        name: spotifyTrack.name,
        artists: spotifyTrack.artists.map(a => a.name),
        album: spotifyTrack.album.name,
        duration_ms: spotifyTrack.duration_ms
      },
      searchTiming: searchResult.timing,
      appleMatches: searchResult.matches.slice(0, 10),
      matchResult: {
        bestMatch: matchResult.bestMatch,
        confidence: matchResult.confidence,
        topScores: matchResult.allScores.slice(0, 5)
      }
    });

  } catch (error) {
    console.error("Single track test error:", error);
    return NextResponse.json(
      { error: "Test failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}