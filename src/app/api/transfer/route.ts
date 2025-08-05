import { NextRequest, NextResponse } from "next/server";
import SpotifyWebApi from "spotify-web-api-node";
import { z } from "zod";
import Fuse from "fuse.js";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { TransferResult, TransferFailure, SuccessfulTransfer, SpotifyTrack, AppleTrack } from "@/types/transfer";
import { simpleMatch } from "./simple-match";

const execAsync = promisify(exec);

const requestSchema = z.object({
  playlistId: z.string().regex(/^[a-zA-Z0-9]+$/),
});

const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

function generateSearchVariations(track: SpotifyTrack): string[] {
  const variations: string[] = [];
  const trackName = track.name;
  const artistNames = track.artists.map(a => a.name);
  const primaryArtist = artistNames[0];
  
  // Track + artist + album FIRST (helps find original versions)
  if (track.album.name) {
    variations.push(`${trackName} ${primaryArtist} ${track.album.name}`);
    variations.push(`${primaryArtist} ${track.album.name} ${trackName}`);
  }
  
  // Original full search
  variations.push(`${trackName} ${artistNames.join(" ")}`);
  
  // Just track name and primary artist
  variations.push(`${trackName} ${primaryArtist}`);
  
  // Remove common suffixes and extras
  const cleanTrackName = trackName
    .replace(/\s*\(.*?\)\s*/g, '') // Remove parentheses content
    .replace(/\s*\[.*?\]\s*/g, '') // Remove bracket content
    .replace(/\s*-\s*.*$/g, '') // Remove everything after dash
    .replace(/\s*(feat\.|ft\.).*$/i, '') // Remove featuring
    .replace(/\s*(remix|mix|edit|version|remaster|remastered).*$/i, '') // Remove version info
    .trim();
  
  if (cleanTrackName !== trackName) {
    variations.push(`${cleanTrackName} ${primaryArtist}`);
  }
  
  // For remixes, try searching for the remixer
  const remixMatch = trackName.match(/\((.*?)\s*(remix|mix)\)/i);
  if (remixMatch) {
    const remixer = remixMatch[1].trim();
    variations.push(`${cleanTrackName} ${remixer}`);
    variations.push(`${trackName.replace(/\s*\(.*?\)\s*/g, '')} ${remixer}`);
  }
  
  // Just the clean track name
  if (cleanTrackName.length > 3) {
    variations.push(cleanTrackName);
  }
  
  // Artist + Album search (helps find complete albums)
  if (track.album.name) {
    // Try just album name for unique albums
    variations.push(track.album.name);
    variations.push(`${primaryArtist} ${track.album.name}`);
    // Also try album name first (sometimes works better)
    variations.push(`${track.album.name} ${primaryArtist}`);
  }
  
  // Just artist name (for popular artists) - put this last
  variations.push(primaryArtist);
  
  return [...new Set(variations)]; // Remove duplicates
}

async function searchAppleMusic(track: SpotifyTrack): Promise<{
  found: boolean;
  matches: AppleTrack[];
  reason?: TransferFailure["reason"];
}> {
  try {
    console.log("iTunes API URL:", process.env.ITUNES_API_URL);
    if (!process.env.ITUNES_API_URL) {
      console.error("ITUNES_API_URL environment variable is not set!");
      return { found: false, matches: [], reason: "api_error" };
    }
    // Store ISRC for later verification since iTunes API doesn't support direct ISRC lookup
    const spotifyISRC = track.external_ids?.isrc;
    console.log(`Spotify track ISRC: ${spotifyISRC}`);

    // Generate search variations
    const searchVariations = generateSearchVariations(track);
    let allMatches: AppleTrack[] = [];
    let searchAttempted = false;

    for (const searchQuery of searchVariations) {
      const searchUrl = `${process.env.ITUNES_API_URL}?term=${encodeURIComponent(searchQuery)}&entity=song&limit=50`;
      console.log("Trying search variation:", searchQuery);
      
      const response = await fetch(searchUrl);
      console.log("Search response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("iTunes API error:", response.status, errorText);
        continue;
      }

      searchAttempted = true;
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        // Convert results to AppleTrack format
        const matches = data.results.map((r: any) => ({
          id: r.trackId?.toString() || '',
          name: r.trackName || '',
          artistName: r.artistName || '',
          albumName: r.collectionName || '',
          url: r.trackViewUrl || '',
          durationMillis: (r.trackTimeMillis || 0).toString(),
          artworkUrl: r.artworkUrl100?.replace('100x100', '600x600') || r.artworkUrl100 || r.artworkUrl60,
          releaseDate: r.releaseDate || r.collectionReleaseDate || '',
          isrc: r.isrc || '', // iTunes API doesn't typically return ISRC
        }));
        
        // Add unique matches only
        for (const match of matches) {
          if (!allMatches.some(m => m.id === match.id)) {
            allMatches.push(match);
          }
        }
      }
    }

    if (!searchAttempted) {
      return { found: false, matches: [], reason: "api_error" };
    }

    if (allMatches.length === 0) {
      return { found: false, matches: [], reason: "not_found" };
    }

    console.log("All matches found:", allMatches.length);
    console.log("First match example:", allMatches[0]);
    
    // USE SIMPLE MATCHING - the complex scoring is clearly broken
    const USE_SIMPLE_MATCHING = true;
    
    if (USE_SIMPLE_MATCHING) {
      const result = simpleMatch(track, allMatches);
      if (result.found) {
        return { found: true, matches: [result.match] };
      } else {
        return { found: false, matches: allMatches.slice(0, 5), reason: "multiple_matches" };
      }
    }

    // Use Fuse.js for fuzzy matching on all collected matches
    const fuse = new Fuse(allMatches, {
      keys: [
        { name: "name", weight: 0.4 },
        { name: "artistName", weight: 0.3 },
        { name: "albumName", weight: 0.2 },
        { name: "durationMillis", weight: 0.1 },
      ],
      threshold: 0.4,
      includeScore: true,
    });

    const searchItem = {
      name: track.name,
      artistName: track.artists.map(a => a.name).join(", "),
      albumName: track.album.name,
      durationMillis: track.duration_ms.toString(),
    };

    const fuseResults = fuse.search(searchItem);
    
    if (fuseResults.length === 0) {
      // Still return all matches for user review
      return { found: false, matches: allMatches.slice(0, 5), reason: "multiple_matches" };
    }

    // Get top matches, but filter out DJ mixes if the original isn't a mix
    let topMatches = fuseResults.map(r => r.item);
    
    // If the Spotify track isn't from a DJ mix album, filter those out
    const spotifyIsDJMix = track.album.name.toLowerCase().includes('dj mix') || 
                          track.album.name.toLowerCase().includes('mixed by');
    
    if (!spotifyIsDJMix) {
      const nonDJMixMatches = topMatches.filter(m => 
        !m.albumName.toLowerCase().includes('dj mix') && 
        !m.albumName.toLowerCase().includes('mixed by') &&
        !m.name.toLowerCase().includes('[mixed]')
      );
      
      // Only use filtered results if we still have matches
      if (nonDJMixMatches.length > 0) {
        console.log(`Filtered out ${topMatches.length - nonDJMixMatches.length} DJ mix versions`);
        topMatches = nonDJMixMatches;
      }
    }
    
    // Limit to top 5
    topMatches = topMatches.slice(0, 5);

    // Check for exact matches first
    const spotifyTrackName = track.name.toLowerCase();
    const spotifyDuration = track.duration_ms;
    const spotifyArtists = track.artists.map(a => a.name.toLowerCase()).sort().join(", ");
    
    // Filter out remixes, mixes, and live versions for exact match checking
    const isRemixOrMix = (trackName: string, albumName: string = '') => {
      const lowerName = trackName.toLowerCase();
      const lowerAlbum = albumName.toLowerCase();
      
      // Check track name for remix indicators
      const trackIndicators = [
        '[mixed]', '[remix]', '(remix)', '(mixed)', 
        ' remix', ' mix)', 'live at', 'dj mix',
        'radio edit', 'extended mix', 'club mix',
        '(feat.', '(with', // Different featured artist format might indicate a different version
      ].some(indicator => lowerName.includes(indicator) && !spotifyTrackName.includes(indicator));
      
      // Check album name for mix/compilation indicators
      const albumIndicators = [
        'dj mix', 'compilation', 'mixed by', 'live at',
        'remix', 'remixes', 'club mix', 'radio mix'
      ].some(indicator => lowerAlbum.includes(indicator));
      
      return trackIndicators || albumIndicators;
    };
    
    // Get Spotify artwork URL if available
    const spotifyArtworkUrl = track.album.images?.[0]?.url;
    
    // Score each match for exact matching
    const scoredMatches = await Promise.all(topMatches.map(async match => {
      const matchName = match.name.toLowerCase();
      const matchArtists = match.artistName.toLowerCase();
      const durationDiff = Math.abs(parseInt(match.durationMillis) - spotifyDuration);
      
      let score = 0;
      
      // Exact name match (highest priority)
      if (matchName === spotifyTrackName) {
        score += 100;
      } else {
        // Partial name match scoring
        const nameWords = spotifyTrackName.split(/\s+/);
        const matchWords = matchName.split(/\s+/);
        const commonWords = nameWords.filter(w => matchWords.includes(w));
        if (commonWords.length >= nameWords.length * 0.8) {
          score += 50; // Most words match
        } else if (commonWords.length >= nameWords.length * 0.5) {
          score += 25; // Half words match
        }
      }
      
      // Artist match (improved logic)
      const spotifyArtistsList = track.artists.map(a => a.name.toLowerCase());
      const matchArtistsList = match.artistName.toLowerCase().split(/[,&]/).map(a => a.trim());
      
      // Check if primary artist matches
      if (spotifyArtistsList[0] === matchArtistsList[0]) {
        score += 40;
      } else if (matchArtistsList.some(ma => spotifyArtistsList.includes(ma))) {
        score += 20;
      }
      
      // Duration match (more lenient for longer tracks)
      const durationTolerance = spotifyDuration > 300000 ? 10000 : 5000; // 10s for tracks > 5min, 5s otherwise
      if (durationDiff < 2000) {
        score += 30;
      } else if (durationDiff < durationTolerance) {
        score += 15;
      } else if (durationDiff < durationTolerance * 2) {
        score += 5;
      }
      
      // Check if it's the same type of track (original vs remix/mix)
      const spotifyIsRemix = isRemixOrMix(track.name, track.album.name);
      const matchIsRemix = isRemixOrMix(match.name, match.albumName);
      
      if (spotifyIsRemix === matchIsRemix) {
        score += 20; // Both are remixes or both are originals
      }
      
      // Bonus for exact ISRC match if available
      if (spotifyISRC && match.isrc === spotifyISRC) {
        score += 100; // ISRC match is definitive
        console.log(`ISRC match found: ${spotifyISRC}`);
      }
      
      // Album name similarity
      const spotifyAlbum = track.album.name.toLowerCase();
      const matchAlbum = match.albumName.toLowerCase();
      
      // Remove common suffixes like "EP", "LP", "Deluxe", etc. for comparison
      const cleanAlbumName = (album: string) => {
        return album.replace(/\s*(ep|lp|deluxe|edition|remaster|remastered|version|extended|special)$/i, '').trim();
      };
      
      const cleanSpotifyAlbum = cleanAlbumName(spotifyAlbum);
      const cleanMatchAlbum = cleanAlbumName(matchAlbum);
      
      if (matchAlbum === spotifyAlbum || cleanMatchAlbum === cleanSpotifyAlbum) {
        score += 40; // Exact album match is very important
      } else if (matchAlbum.includes(spotifyAlbum) || spotifyAlbum.includes(matchAlbum) ||
                 cleanMatchAlbum.includes(cleanSpotifyAlbum) || cleanSpotifyAlbum.includes(cleanMatchAlbum)) {
        score += 20; // Partial album match
      }
      
      // Artwork similarity check (if both artwork URLs are available)
      let artworkSimilarity = 0;
      const enableArtworkComparison = false; // Temporarily disabled for performance
      if (enableArtworkComparison && spotifyArtworkUrl && match.artworkUrl) {
        try {
          // Use exec directly instead of API call for server-side execution
          const scriptPath = path.join(process.cwd(), 'scripts', 'compare_artwork.py');
          const inputData = JSON.stringify({ url1: spotifyArtworkUrl, url2: match.artworkUrl });
          
          const { stdout } = await execAsync(
            `echo '${inputData.replace(/'/g, "'\\''")}' | python3 "${scriptPath}"`,
            {
              encoding: 'utf8',
              timeout: 5000 // 5 second timeout per comparison
            }
          );
          
          const result = JSON.parse(stdout);
          artworkSimilarity = result.similarity || 0;
          
          // Add significant bonus for very similar artwork
          if (artworkSimilarity > 90) {
            score += 50; // Near identical artwork
          } else if (artworkSimilarity > 70) {
            score += 30; // Very similar artwork
          } else if (artworkSimilarity > 50) {
            score += 15; // Somewhat similar artwork
          }
        } catch (error) {
          console.error("Artwork comparison error:", error);
          // Continue without artwork score
        }
      }
      
      // Debug logging - always log for tracks that should match
      const shouldLog = score > 100 || 
        match.albumName.toLowerCase().includes('bangarang') || 
        match.name.toLowerCase().includes('summit') ||
        (matchName === spotifyTrackName && durationDiff < 5000) || // Exact name + good duration
        track.name.includes("Angel On My Shoulder") ||
        track.name.includes("Summit") ||
        track.name.includes("Pressure") ||
        track.name.includes("Filmic") ||
        track.name.includes("Days to Come") ||
        track.name.includes("1998") ||
        track.name.includes("Right Back") ||
        track.name.includes("Beautiful People");
        
      if (shouldLog) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Spotify Track: "${track.name}" by ${track.artists.map(a => a.name).join(", ")}`);
        console.log(`Spotify Album: "${track.album.name}"`);
        console.log(`Spotify Duration: ${track.duration_ms}ms`);
        console.log(`\nCandidate Match: "${match.name}" by ${match.artistName}`);
        console.log(`Apple Album: "${match.albumName}"`);
        console.log(`Apple Duration: ${match.durationMillis}ms`);
        console.log(`\nScore Calculation:`);
        console.log(`  Name match: "${matchName}" === "${spotifyTrackName}" = ${matchName === spotifyTrackName} (+${matchName === spotifyTrackName ? 100 : 0})`);
        console.log(`  Artist match: "${matchArtists}" vs "${spotifyArtists}" = ${matchArtists === spotifyArtists || spotifyArtists.includes(matchArtists)} (+${matchArtists === spotifyArtists || spotifyArtists.includes(matchArtists) ? 50 : 0})`);
        console.log(`  Duration diff: ${durationDiff}ms (+${durationDiff < 2000 ? 40 : durationDiff < 5000 ? 20 : 0})`);
        console.log(`  Not remix: ${!isRemixOrMix(match.name, match.albumName)} (+${!isRemixOrMix(match.name, match.albumName) ? 30 : 0})`);
        const albumScore = matchAlbum === spotifyAlbum || cleanMatchAlbum === cleanSpotifyAlbum ? 40 : 
                          (matchAlbum.includes(spotifyAlbum) || spotifyAlbum.includes(matchAlbum) || 
                           cleanMatchAlbum.includes(cleanSpotifyAlbum) || cleanSpotifyAlbum.includes(cleanMatchAlbum)) ? 20 : 0;
        console.log(`  Album match: "${cleanMatchAlbum}" vs "${cleanSpotifyAlbum}" = ${albumScore > 0} (+${albumScore})`);
        console.log(`    - Original: "${matchAlbum}" vs "${spotifyAlbum}"`);
        console.log(`  Artwork similarity: ${artworkSimilarity.toFixed(1)}% (+${artworkSimilarity > 90 ? 50 : artworkSimilarity > 70 ? 30 : artworkSimilarity > 50 ? 15 : 0})`);
        console.log(`  TOTAL SCORE: ${score}`);
        console.log(`${'='.repeat(60)}`);
      }
      
      return { match, score };
    }));
    
    // Sort by score
    scoredMatches.sort((a, b) => b.score - a.score);
    
    // Log the top matches and their scores for problematic tracks
    const isProblematicTrack = [
      "Angel On My Shoulder", "Summit", "Pressure", "Filmic", 
      "Days to Come", "1998", "Right Back", "Beautiful People"
    ].some(name => track.name.includes(name));
    
    if (isProblematicTrack || (scoredMatches.length > 0 && scoredMatches[0].score > 100)) {
      console.log(`\n>>> Final Scoring Results for "${track.name}":`);
      console.log(`Top 3 matches:`);
      scoredMatches.slice(0, 3).forEach((sm, idx) => {
        console.log(`  ${idx + 1}. Score: ${sm.score} - "${sm.match.name}" by ${sm.match.artistName} (${sm.match.albumName})`);
      });
      console.log(`Current threshold logic: base=130, single match with score>=100, or clear winner`);
      console.log(`Decision will be made based on dynamic threshold`);
    }
    
    // More aggressive threshold strategy
    let threshold = 100; // Lower base threshold
    
    // If there's only one match, be very lenient
    if (scoredMatches.length === 1 && scoredMatches[0].score >= 80) {
      console.log(`Single match found with score ${scoredMatches[0].score}, auto-selecting`);
      return { found: true, matches: [scoredMatches[0].match] };
    }
    
    // If the top match is significantly better than the second, auto-select
    if (scoredMatches.length >= 2) {
      const topScore = scoredMatches[0].score;
      const secondScore = scoredMatches[1].score;
      
      // More aggressive: if top score is 30% better, that's good enough
      if (topScore >= 90 && topScore > secondScore * 1.3) {
        console.log(`Clear winner: ${topScore} vs ${secondScore}, auto-selecting`);
        return { found: true, matches: [scoredMatches[0].match] };
      }
    }
    
    // Special cases for exact matches
    if (scoredMatches.length > 0) {
      const topMatch = scoredMatches[0];
      const exactName = topMatch.match.name.toLowerCase() === spotifyTrackName;
      const exactArtist = topMatch.match.artistName.toLowerCase() === track.artists.map(a => a.name).join(", ").toLowerCase();
      const exactAlbum = topMatch.match.albumName.toLowerCase() === track.album.name.toLowerCase();
      
      // Exact name + artist = auto-select
      if (exactName && exactArtist) {
        console.log(`Exact name + artist match, auto-selecting`);
        return { found: true, matches: [topMatch.match] };
      }
      
      // Exact name + album = very likely correct
      if (exactName && exactAlbum && topMatch.score >= 80) {
        console.log(`Exact name + album match, auto-selecting`);
        return { found: true, matches: [topMatch.match] };
      }
      
      // High score with good duration match = auto-select
      const durationDiff = Math.abs(parseInt(topMatch.match.durationMillis) - track.duration_ms);
      if (topMatch.score >= 100 && durationDiff < 5000) {
        console.log(`High score ${topMatch.score} with good duration match, auto-selecting`);
        return { found: true, matches: [topMatch.match] };
      }
    }
    
    // Auto-select if above threshold
    if (scoredMatches.length > 0 && scoredMatches[0].score >= threshold) {
      console.log(`Score ${scoredMatches[0].score} above threshold ${threshold}, auto-selecting`);
      return { found: true, matches: [scoredMatches[0].match] };
    }
    
    // If we have a good match but not perfect, still return multiple options
    const finalMatches = scoredMatches.slice(0, 5).map(s => s.match);

    // Otherwise, return multiple matches for user selection
    return { found: false, matches: finalMatches, reason: "multiple_matches" };
  } catch (error) {
    console.error("Apple Music search error for track:", track.name);
    console.error("Error details:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    return { found: false, matches: [], reason: "api_error" };
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
    console.log("Transfer request:", body);
    
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
      const searchResult = await searchAppleMusic(track);
      
      if (!searchResult.found) {
        const failure: TransferFailure = {
          spotifyTrack: track,
          reason: searchResult.reason || "not_found",
          details: getFailureDetails(searchResult.reason || "not_found", track),
          suggestedAction: getSuggestedAction(searchResult.reason || "not_found", track),
          possibleMatches: searchResult.matches,
        };
        failures.push(failure);
      } else {
        // Track successful match
        successful.push({
          spotifyTrack: track,
          appleTrack: searchResult.matches[0], // First match is the selected one
        });
      }
      
      // Rate limiting - be nice to the iTunes API
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
      return `Multiple similar tracks were found, making it difficult to determine the exact match.`;
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