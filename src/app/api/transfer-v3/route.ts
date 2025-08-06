import { NextRequest, NextResponse } from "next/server";
import SpotifyWebApi from "spotify-web-api-node";
import { getServerSession } from "next-auth";
import { matchTracks } from "@/lib/track-matching-algorithm";
import { searchMusicKitByMetadata } from "@/lib/musickit-search";
import { searchMusicKitAlbum, searchMusicKitArtist, getMusicKitArtistAlbums, getMusicKitAlbumTracks } from "@/lib/musickit-album-search";
import { compareAlbumArt } from "@/lib/album-art-similarity";
import { analyzeUnavailability } from "@/lib/unavailability-detector";
import { validateAlbumExistence } from "@/lib/external-music-validators";
import { TransferResult, TransferFailure, SpotifyTrack, AppleTrack, SuccessfulTransfer } from "@/types/transfer";

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

// Search Apple Music using hierarchical approach: Album → Artist/Album → Song
async function searchAppleMusic(track: SpotifyTrack): Promise<{ matches: AppleTrack[]; timing: any; albumNotFound?: boolean }> {
  console.log(`\n🎯 HIERARCHICAL SEARCH for: "${track.name}" by ${track.artists[0].name} from album "${track.album.name}"`);
  const startTime = Date.now();
  let musicKitResults: AppleTrack[] = [];
  let hasIsrcMatch = false;
  let albumNotFound = false;
  
  // First, try MusicKit if credentials are available
  if (process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY) {
    // Step 1: Try direct album search
    console.log(`\n1️⃣ Searching for album directly...`);
    const album = await searchMusicKitAlbum(track.artists[0].name, track.album.name);
    
    if (album) {
      console.log(`  ✓ Found album: "${album.attributes.name}" by ${album.attributes.artistName}`);
      
      // Get tracks from this album
      const albumTracks = await getMusicKitAlbumTracks(album.id);
      console.log(`  Found ${albumTracks.length} tracks in album`);
      
      // Filter for our specific track
      musicKitResults = albumTracks.filter(t => {
        const nameMatch = t.name.toLowerCase().includes(track.name.toLowerCase()) ||
                         track.name.toLowerCase().includes(t.name.toLowerCase());
        return nameMatch;
      });
      
      if (musicKitResults.length > 0) {
        console.log(`  ✓ Found track "${track.name}" in album!`);
        return {
          matches: musicKitResults,
          timing: { duration_ms: Date.now() - startTime, apiCalls: 2 },
          albumNotFound: false
        };
      }
    }
    
    // Step 2: Search by artist, then check their albums
    console.log(`\n2️⃣ Album direct search failed, searching by artist...`);
    const artist = await searchMusicKitArtist(track.artists[0].name);
    
    if (artist) {
      console.log(`  ✓ Found artist: "${artist.attributes.name}"`);
      
      // Get all albums for this artist
      const artistAlbums = await getMusicKitArtistAlbums(artist.id);
      console.log(`  Artist has ${artistAlbums.length} albums on Apple Music`);
      
      // Check if our album exists
      const matchingAlbum = artistAlbums.find(a => {
        const albumName = a.attributes.name.toLowerCase();
        const searchAlbum = track.album.name.toLowerCase();
        return albumName === searchAlbum || albumName.includes(searchAlbum) || searchAlbum.includes(albumName);
      });
      
      if (!matchingAlbum) {
        console.log(`  ❌ Album "${track.album.name}" NOT FOUND in artist's discography`);
        albumNotFound = true;
        
        // Validate with external sources
        console.log(`  🔍 Checking external databases...`);
        const externalValidation = await validateAlbumExistence(
          track.artists[0].name,
          track.album.name
        );
        
        if (externalValidation.exists) {
          console.log(`  ✓ Album confirmed to exist by: ${externalValidation.sources.map(s => s.source).join(', ')}`);
          console.log(`    Confidence: ${externalValidation.confidence}%`);
          if (externalValidation.sources[0]?.releaseYear) {
            console.log(`    Release year: ${externalValidation.sources[0].releaseYear}`);
          }
        }
      }
    }
    
    // Step 3: Check if this might be a soundtrack track
    console.log(`\n3️⃣ Checking if this might be a soundtrack track...`);
    
    // Common soundtrack album patterns
    const soundtrackPatterns = [
      'soundtrack', 'motion picture', 'original score', 'ost', 
      'music from', 'music inspired by', 'score'
    ];
    
    // If album not found and it's NOT already a soundtrack, try searching soundtracks
    const albumLower = track.album.name.toLowerCase();
    const isAlreadySoundtrack = soundtrackPatterns.some(pattern => albumLower.includes(pattern));
    
    if (albumNotFound && !isAlreadySoundtrack) {
      console.log(`  Album not found, searching for "${track.name}" in soundtracks...`);
      
      // Search for the track name + "soundtrack" AND album name + soundtrack
      const soundtrackSearches = [
        `${track.name} soundtrack`,
        `${track.name} motion picture`,
        `${track.name} original soundtrack`,
        `${track.album.name} soundtrack`,
        `${track.album.name} motion picture`,
        `${track.artists[0].name} ${track.album.name}`, // Artist + album name
        `${track.artists[0].name} ${track.name}` // Fallback to basic search
      ];
      
      for (const searchTerm of soundtrackSearches) {
        const soundtrackResults = await searchMusicKitByMetadata({
          ...track,
          name: searchTerm,
          artists: [{ name: track.artists[0].name }]
        });
        
        if (soundtrackResults.length > 0) {
          console.log(`  ✓ Found ${soundtrackResults.length} potential soundtrack matches`);
          
          // Filter for tracks that match our original track name
          const matchingTracks = soundtrackResults.filter(r => {
            const rNameLower = r.name.toLowerCase();
            const trackNameLower = track.name.toLowerCase();
            const rArtistLower = r.artistName.toLowerCase();
            const spotifyArtistLower = track.artists[0].name.toLowerCase();
            
            // More flexible matching for soundtracks
            const trackNameMatch = rNameLower === trackNameLower ||
                                 rNameLower.includes(trackNameLower) ||
                                 trackNameLower.includes(rNameLower) ||
                                 // Handle punctuation differences like P.E.T.R.O.L. vs PETROL
                                 rNameLower.replace(/[^a-z0-9]/g, '') === trackNameLower.replace(/[^a-z0-9]/g, '');
            
            const artistMatch = rArtistLower === spotifyArtistLower ||
                               rArtistLower.includes(spotifyArtistLower) ||
                               spotifyArtistLower.includes(rArtistLower);
            
            // Check if it's a soundtrack album
            const isSoundtrackAlbum = r.albumName.toLowerCase().includes('soundtrack') ||
                                     r.albumName.toLowerCase().includes('motion picture') ||
                                     r.albumName.toLowerCase().includes('music from');
            
            return trackNameMatch && artistMatch && isSoundtrackAlbum;
          });
          
          if (matchingTracks.length > 0) {
            console.log(`  ✓ Found track on soundtrack: "${matchingTracks[0].albumName}"`);
            musicKitResults.push(...matchingTracks);
          }
        }
      }
    }
    
    // Step 4: Fall back to regular search
    console.log(`\n4️⃣ Falling back to standard search...`);
    if (track.external_ids?.isrc) {
      console.log(`  ISRC available: ${track.external_ids.isrc}`);
    }
    
    try {
      musicKitResults = await searchMusicKitByMetadata(track);
      
      if (musicKitResults.length > 0) {
        console.log(`  Found ${musicKitResults.length} matches via MusicKit`);
        
        // Check for ISRC match
        if (track.external_ids?.isrc) {
          const isrcMatch = musicKitResults.find(r => r.isrc === track.external_ids?.isrc);
          if (isrcMatch) {
            console.log(`  ✓ EXACT ISRC MATCH FOUND: "${isrcMatch.name}"`);
            
            // Check if the ISRC match is a different version than requested
            const spotifyIsExtended = track.name.toLowerCase().includes('extended') || 
                                     track.name.toLowerCase().includes('remix');
            const appleIsExtended = isrcMatch.name.toLowerCase().includes('extended') || 
                                   isrcMatch.name.toLowerCase().includes('remix') ||
                                   isrcMatch.name.toLowerCase().includes('radio edit');
            
            // If Spotify is original but Apple ISRC match is a version, also search iTunes
            if (!spotifyIsExtended && appleIsExtended) {
              console.log(`  ⚠️  ISRC match is a different version (${isrcMatch.name}), will also search iTunes for original`);
              hasIsrcMatch = false; // Allow iTunes search
            } else {
              hasIsrcMatch = true;
              return {
                matches: musicKitResults,
                timing: {
                  duration_ms: Date.now() - startTime,
                  apiCalls: 1,
                  searchDetails: [{
                    query: 'MusicKit API',
                    duration: Date.now() - startTime,
                    resultCount: musicKitResults.length,
                    status: 200
                  }]
                }
              };
            }
          }
        }
      }
    } catch (error) {
      console.error('MusicKit search failed:', error);
    }
  }
  
  // Always also search iTunes API for more comprehensive results (unless we have ISRC match)
  if (!hasIsrcMatch) {
    console.log(`Also searching iTunes API for more results...`);
    
    try {
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
    
    const searchQuery = `${normalizedArtistName} ${normalizedTrackName}`;
    const searchUrl = `${process.env.ITUNES_API_URL}?term=${encodeURIComponent(searchQuery)}&country=US&entity=song&limit=25`;
    
    const response = await fetch(searchUrl);
    
    if (!response.ok) {
      throw new Error(`iTunes API error: ${response.status}`);
    }

    const data = await response.json();
    
    const matches = (data.results || []).map((r: any) => ({
      id: r.trackId?.toString() || '',
      name: r.trackName || '',
      artistName: r.artistName || '',
      albumName: r.collectionName || '',
      url: r.trackViewUrl || '',
      durationMillis: r.trackTimeMillis || 0,
      artworkUrl: r.artworkUrl100?.replace('100x100', '600x600') || r.artworkUrl100 || r.artworkUrl60,
      releaseDate: r.releaseDate || r.collectionReleaseDate || '',
    }));
    
    // Combine MusicKit and iTunes results, removing duplicates
    const allMatches = [...musicKitResults];
    const existingIds = new Set(musicKitResults.map(m => m.id));
    
    for (const iTunesMatch of matches) {
      if (!existingIds.has(iTunesMatch.id)) {
        allMatches.push(iTunesMatch);
      }
    }
    
    console.log(`  Combined results: ${allMatches.length} unique tracks (${musicKitResults.length} from MusicKit, ${matches.length} from iTunes)`);
    
    return {
      matches: allMatches,
      timing: {
        duration_ms: Date.now() - startTime,
        apiCalls: musicKitResults.length > 0 ? 2 : 1,
        searchDetails: [{
          query: searchQuery,
          duration: Date.now() - startTime,
          resultCount: allMatches.length,
          status: 200
        }]
      },
      albumNotFound
    };
  } catch (error) {
    console.error("Apple Music search error:", error);
    return {
      matches: musicKitResults, // Return MusicKit results if iTunes fails
      timing: {
        duration_ms: Date.now() - startTime,
        apiCalls: musicKitResults.length > 0 ? 1 : 0,
        searchDetails: []
      }
    };
  }
  }
  
  // If we only have MusicKit results (due to ISRC match or iTunes not searched)
  return {
    matches: musicKitResults,
    timing: {
      duration_ms: Date.now() - startTime,
      apiCalls: 1,
      searchDetails: []
    },
    albumNotFound
  };
}

export async function POST(request: NextRequest) {
  console.log("Transfer v3 endpoint called");
  
  try {
    const session = await getServerSession();
    if (!session) {
      console.error("No session found");
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get access token from Authorization header
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "");
    
    if (!accessToken) {
      console.error("No access token provided");
      return NextResponse.json({ error: "Access token required" }, { status: 401 });
    }

    const body = await request.json();
    console.log("Request body:", body);
    const { playlistId, batchSize = 5, batchOffset: batchOffset = 0 } = body;
    
    if (!playlistId) {
      console.error("No playlist ID provided");
      return NextResponse.json({ error: "Playlist ID required" }, { status: 400 });
    }

    spotifyApi.setAccessToken(accessToken);

    // Check if it's a Spotify-curated playlist
    const isSpotifyCurated = playlistId.startsWith('37i9');
    
    // Get playlist details
    let playlist;
    try {
      playlist = await spotifyApi.getPlaylist(playlistId);
    } catch (spotifyError: any) {
      console.error("Spotify API error:", spotifyError);
      
      // Special handling for Spotify-curated playlists
      if (isSpotifyCurated && spotifyError.statusCode === 404) {
        // Try with market parameter for curated playlists
        try {
          console.log("Retrying with market parameter for curated playlist...");
          playlist = await spotifyApi.getPlaylist(playlistId, { market: 'US' });
        } catch (retryError: any) {
          return NextResponse.json(
            { error: "Cannot access this Spotify-curated playlist. Try copying it to your own library first." },
            { status: 404 }
          );
        }
      } else if (spotifyError.statusCode === 404) {
        return NextResponse.json(
          { error: "Playlist not found. Please check the URL and make sure the playlist is public." },
          { status: 404 }
        );
      } else if (spotifyError.statusCode === 403) {
        return NextResponse.json(
          { error: "Access denied. The playlist might be private or region-locked." },
          { status: 403 }
        );
      } else {
        return NextResponse.json(
          { error: `Spotify error: ${spotifyError.body?.error?.message || spotifyError.message || "Unknown error"}` },
          { status: spotifyError.statusCode || 500 }
        );
      }
    }
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
    const overallStartTime = Date.now();
    let isrcMatchCount = 0;

    // Process only a batch of tracks to stay within 10-second Vercel Hobby limit
    const trackBatch = tracks.slice(batchOffset, batchOffset + batchSize);
    console.log(`Processing batch: tracks ${batchOffset + 1}-${Math.min(batchOffset + batchSize, tracks.length)} of ${tracks.length}`);

    for (const track of trackBatch) {
      const searchResult = await searchAppleMusic(track);
      const appleMatches = searchResult.matches;
      
      // Check if we got an ISRC match
      if (track.external_ids?.isrc && appleMatches.some(m => m.isrc === track.external_ids?.isrc)) {
        isrcMatchCount++;
      }
      
      // Use the matching algorithm - it will handle all filtering and matching
      console.log(`\nProcessing: "${track.name}" by ${track.artists[0].name}`);
      const matchResult = matchTracks(track, appleMatches);
      
      if (matchResult.bestMatch && matchResult.confidence !== 'none') {
        console.log(`  ✓ Matched to: "${matchResult.bestMatch.name}" by ${matchResult.bestMatch.artistName}`);
        successful.push({
          spotifyTrack: track,
          appleTrack: matchResult.bestMatch,
        });
      } else {
        console.log(`  ✗ No confident match found`);
        
        // Analyze why the track wasn't found
        const unavailabilityAnalysis = analyzeUnavailability(
          track,
          appleMatches,
          !searchResult.albumNotFound
        );
        
        let reason: TransferFailure['reason'] = appleMatches.length === 0 ? "not_found" : "multiple_matches";
        let details = matchResult.reason || "No confident match found";
        let suggestedAction = "Manual review required";
        
        if (unavailabilityAnalysis.confidence >= 70) {
          reason = "album_not_available";
          details = `${unavailabilityAnalysis.confidence}% confident this track is not available on Apple Music. ${unavailabilityAnalysis.reasons.join('. ')}`;
          suggestedAction = unavailabilityAnalysis.closestMatches.length > 0 
            ? "Consider selecting one of the closest matches below"
            : "Search for alternative releases or compilations";
        }
        
        failures.push({
          spotifyTrack: track,
          reason,
          details,
          suggestedAction,
          possibleMatches: matchResult.allScores.length > 0 
            ? matchResult.allScores.slice(0, 5).map(s => s.track)
            : appleMatches.slice(0, 5),
          unavailableConfidence: unavailabilityAnalysis.confidence,
          closestMatches: unavailabilityAnalysis.closestMatches
        });
      }
      
      // Rate limiting for iTunes API (not needed for MusicKit)
      if (!process.env.APPLE_TEAM_ID) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    const result: TransferResult = {
      playlistName: playlist.body.name,
      totalTracks: tracks.length,
      successfulTransfers: successful.length,
      successful,
      failures,
      transferDate: new Date().toISOString(),
      spotifyPlaylistUrl: playlist.body.external_urls.spotify,
      timing: {
        overallDuration: Date.now() - overallStartTime,
        trackTimings: [],
        totalApiCalls: trackBatch.length,
      },
      metadata: {
        isrcMatchCount,
        usedMusicKit: !!process.env.APPLE_TEAM_ID,
        batch: {
          batchOffset,
          batchSize,
          processedInThisBatch: trackBatch.length,
          remainingTracks: Math.max(0, tracks.length - (batchOffset + batchSize)),
          isComplete: batchOffset + batchSize >= tracks.length,
        }
      }
    };

    console.log(`\nTransfer complete:`);
    console.log(`  Total tracks: ${tracks.length}`);
    console.log(`  Successful: ${successful.length}`);
    console.log(`  Failed: ${failures.length}`);
    console.log(`  ISRC matches: ${isrcMatchCount}`);

    return NextResponse.json(result);

  } catch (error) {
    console.error("Transfer error:", error);
    return NextResponse.json(
      { error: "Transfer failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}