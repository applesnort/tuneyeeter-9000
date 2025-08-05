// SIMPLE MATCHING LOGIC - if it looks like a duck, it's a duck

export function simpleMatch(spotifyTrack: any, appleMatches: any[]): {
  found: boolean;
  match?: any;
  reason?: string;
} {
  if (!appleMatches || appleMatches.length === 0) {
    return { found: false, reason: "No matches found" };
  }

  const spotifyName = spotifyTrack.name.toLowerCase();
  const spotifyArtist = spotifyTrack.artists[0].name.toLowerCase();
  const spotifyDuration = spotifyTrack.duration_ms;
  const spotifyReleaseDate = spotifyTrack.album.release_date; // YYYY-MM-DD format

  // RULE 1: If there's only ONE match, just fucking take it
  if (appleMatches.length === 1) {
    console.log(`Only one match found for "${spotifyTrack.name}", auto-selecting`);
    return { found: true, match: appleMatches[0] };
  }

  // Helper to check if it's a compilation/hits album
  const isCompilationAlbum = (albumName: string) => {
    const lower = albumName.toLowerCase();
    return lower.includes('hits') || lower.includes('compilation') || 
           lower.includes('best of') || lower.includes('greatest') ||
           lower.includes('collection') || lower.includes('various artists');
  };

  // RULE 2: Find exact name + artist matches
  const exactMatches = appleMatches.filter(match => {
    const matchName = match.name.toLowerCase();
    const matchArtist = match.artistName.toLowerCase();
    
    // Debug logging for problem tracks
    if (spotifyName.includes("angel on my shoulder")) {
      console.log(`Checking match: "${match.name}" by ${match.artistName}`);
      console.log(`  Spotify: "${spotifyName}" by ${spotifyArtist}`);
      console.log(`  Name match: ${matchName === spotifyName}`);
      console.log(`  Artist match: ${matchArtist === spotifyArtist || matchArtist.includes(spotifyArtist)}`);
    }
    
    // Names must match EXACTLY (including remix info)
    if (matchName !== spotifyName) {
      // Check if one is a remix and the other isn't
      const spotifyIsRemix = spotifyName.includes('remix') || spotifyName.includes('mix)');
      const matchIsRemix = matchName.includes('remix') || matchName.includes('mix)');
      
      if (spotifyIsRemix !== matchIsRemix) {
        return false; // One is remix, other isn't = NOT A MATCH
      }
      
      // If both are remixes but different names, not a match
      return false;
    }
    
    // Skip compilation albums unless the Spotify track is also from a compilation
    if (isCompilationAlbum(match.albumName) && !isCompilationAlbum(spotifyTrack.album.name)) {
      console.log(`Skipping compilation album match: ${match.albumName}`);
      return false;
    }
    
    return matchArtist === spotifyArtist || matchArtist.includes(spotifyArtist) || 
           spotifyArtist.includes(matchArtist);
  });

  // If we have exact matches, strongly prefer ones with matching release dates
  if (exactMatches.length > 1 && spotifyReleaseDate) {
    const dateMatches = exactMatches.filter(match => {
      if (!match.releaseDate) return false;
      // Compare just the date part (YYYY-MM-DD)
      const appleDate = match.releaseDate.split('T')[0];
      return appleDate === spotifyReleaseDate;
    });
    
    if (dateMatches.length === 1) {
      console.log(`Exact name+artist+date match for "${spotifyTrack.name}", auto-selecting`);
      return { found: true, match: dateMatches[0] };
    } else if (dateMatches.length > 1) {
      // Multiple exact matches with same date, pick closest duration
      const bestMatch = dateMatches.reduce((best, current) => {
        const bestDiff = Math.abs(parseInt(best.durationMillis) - spotifyDuration);
        const currentDiff = Math.abs(parseInt(current.durationMillis) - spotifyDuration);
        return currentDiff < bestDiff ? current : best;
      });
      return { found: true, match: bestMatch };
    }
    
    // If no exact date matches but we have release dates, check for close dates
    const nearDateMatches = exactMatches.filter(match => {
      if (!match.releaseDate) return false;
      const spotifyDate = new Date(spotifyReleaseDate);
      const appleDate = new Date(match.releaseDate.split('T')[0]);
      const daysDiff = Math.abs((spotifyDate.getTime() - appleDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff <= 1; // Within 1 day
    });
    
    if (nearDateMatches.length > 0) {
      console.log(`WARNING: Found exact name+artist match but dates differ by ≤1 day for "${spotifyTrack.name}"`);
      // Still return it but log the warning
      return { found: true, match: nearDateMatches[0] };
    }
    
    // If dates are more than 1 day apart, it's suspicious - don't auto-select
    console.log(`REJECTED: Exact name+artist matches found but release dates differ >1 day for "${spotifyTrack.name}"`);
    return { found: false, match: exactMatches[0], reason: "Release date mismatch" };
  }

  if (exactMatches.length === 1) {
    console.log(`One exact name+artist match for "${spotifyTrack.name}", auto-selecting`);
    return { found: true, match: exactMatches[0] };
  }
  
  // Debug: why didn't we find exact matches?
  if (exactMatches.length === 0 && spotifyName.includes("angel on my shoulder")) {
    console.log(`No exact matches found for "${spotifyTrack.name}"`);
    console.log(`All matches: ${appleMatches.map(m => `"${m.name}" by ${m.artistName}`).join(', ')}`);
  }

  // RULE 3: If multiple exact matches, pick the one with closest duration
  if (exactMatches.length > 1) {
    const bestMatch = exactMatches.reduce((best, current) => {
      const bestDiff = Math.abs(parseInt(best.durationMillis) - spotifyDuration);
      const currentDiff = Math.abs(parseInt(current.durationMillis) - spotifyDuration);
      return currentDiff < bestDiff ? current : best;
    });
    
    console.log(`Multiple exact matches for "${spotifyTrack.name}", picking closest duration`);
    return { found: true, match: bestMatch };
  }

  // RULE 4: No exact match? Find matches with similar artist AND duration
  const artistMatches = appleMatches.filter(match => {
    const matchArtist = match.artistName.toLowerCase();
    
    // Check release date isn't too different (if dates available)
    if (spotifyReleaseDate && match.releaseDate) {
      const spotifyDate = new Date(spotifyReleaseDate);
      const appleDate = new Date(match.releaseDate.split('T')[0]);
      const daysDiff = Math.abs((spotifyDate.getTime() - appleDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // For partial matches, be more lenient but still reasonable
      // Same year = likely same recording
      // Different year = possibly remaster/re-release
      const spotifyYear = parseInt(spotifyReleaseDate.substring(0, 4));
      const appleYear = parseInt(match.releaseDate.substring(0, 4));
      
      if (Math.abs(spotifyYear - appleYear) > 2) {
        // More than 2 years difference for non-exact matches is suspicious
        return false;
      }
    }
    
    // Artist must at least partially match
    return matchArtist.includes(spotifyArtist) || spotifyArtist.includes(matchArtist) ||
           // Or check if any word from spotify artist is in apple artist
           spotifyArtist.split(/\s+/).some(word => matchArtist.includes(word));
  });

  if (artistMatches.length > 0) {
    // From artist matches, find ones with close duration
    const durationMatches = artistMatches.filter(match => {
      const durationDiff = Math.abs(parseInt(match.durationMillis) - spotifyDuration);
      // Much stricter: 5 seconds max for same track
      // 166 seconds difference = clearly different version!
      return durationDiff < 5000; // Within 5 seconds only
    });

    if (durationMatches.length > 0) {
      // Pick the one with the most similar name and release year
      const bestMatch = durationMatches.reduce((best, current) => {
        let bestScore = similarity(best.name.toLowerCase(), spotifyName);
        let currentScore = similarity(current.name.toLowerCase(), spotifyName);
        
        // Bonus for matching release year
        if (spotifyReleaseDate && best.releaseDate) {
          const spotifyYear = spotifyReleaseDate.substring(0, 4);
          const bestYear = best.releaseDate.substring(0, 4);
          if (spotifyYear === bestYear) bestScore += 0.2;
        }
        
        if (spotifyReleaseDate && current.releaseDate) {
          const spotifyYear = spotifyReleaseDate.substring(0, 4);
          const currentYear = current.releaseDate.substring(0, 4);
          if (spotifyYear === currentYear) currentScore += 0.2;
        }
        
        return currentScore > bestScore ? current : best;
      });

      console.log(`Found match with similar artist and duration for "${spotifyTrack.name}"`);
      return { found: true, match: bestMatch };
    }
  }

  // RULE 5: LAST RESORT - Try to find the base track (non-remix) version
  // Only use this if we're looking for a remix and can't find it
  const spotifyIsRemix = spotifyName.includes('remix') || spotifyName.includes('mix)');
  
  if (spotifyIsRemix && artistMatches.length === 0) {
    const baseTrackMatches = appleMatches.filter(match => {
      const matchName = match.name.toLowerCase();
      const matchArtist = match.artistName.toLowerCase();
      
      // Skip if it's also a remix or from compilation
      if (matchName.includes('remix') || matchName.includes('mix)') || 
          isCompilationAlbum(match.albumName)) {
        return false;
      }
      
      // Extract base track name
      const spotifyBaseName = spotifyName.replace(/\s*\(.*?\)\s*/g, '').replace(/\s*-\s*.*$/, '').trim();
      
      // Must have exact base name and artist
      return matchName === spotifyBaseName && 
             (matchArtist === spotifyArtist || matchArtist.includes(spotifyArtist));
    });
    
    if (baseTrackMatches.length > 0) {
      console.log(`WARNING: Could not find remix "${spotifyTrack.name}", found original version instead`);
      // Don't auto-select, just return as failure with suggestion
      return { 
        found: false, 
        match: baseTrackMatches[0], 
        reason: "Only found original version, not the remix" 
      };
    }
  }

  // RULE 6: Give up
  console.log(`No good match found for "${spotifyTrack.name}"`);
  return { found: false, reason: "No close matches found" };
}

// Simple string similarity (0-1)
function similarity(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s2.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s1.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(j - 1) !== s2.charAt(i - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s1.length] = lastValue;
  }
  return costs[s2.length];
}