/**
 * Best Practice Music Track Matching Algorithm
 * Based on research from MusicBrainz, academic papers, and industry practices
 */

import { SpotifyTrack, AppleTrack } from "@/types/transfer";

interface MatchScore {
  track: AppleTrack;
  totalScore: number;
  breakdown: {
    isrcMatch: number;
    titleSimilarity: number;
    artistSimilarity: number;
    albumSimilarity: number;
    durationSimilarity: number;
    releaseDateSimilarity: number;
    isCompilation: boolean;
    isRemixMatch: boolean;
  };
  confidence: 'high' | 'medium' | 'low' | 'none';
}

interface MatchingWeights {
  isrc: number;
  title: number;
  artist: number;
  album: number;
  duration: number;
  releaseDate: number;
}

// Research-based optimal weights
// Adjusted since iTunes API doesn't provide ISRC
const DEFAULT_WEIGHTS: MatchingWeights = {
  isrc: 0.0,        // Not available from iTunes API
  title: 0.35,      // Increased weight - Title must match closely
  artist: 0.30,     // Increased weight - Artist is critical
  album: 0.20,      // Album helps confirm
  duration: 0.10,   // Duration should be close
  releaseDate: 0.05, // Release date as tiebreaker
};

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate normalized string similarity (0-1)
 */
function stringSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;
  
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  
  if (str1 === str2) return 1.0;
  
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
}

/**
 * Normalize strings for comparison - Unicode normalization + aggressive normalization for fuzzy matching
 */
function normalizeString(str: string): string {
  return str
    // Apply Unicode NFC normalization first (Apple's preferred form)
    .normalize('NFC')
    .toLowerCase()
    .trim()
    // Handle common character variations
    .replace(/&/g, 'and')  // & → and
    .replace(/['']/g, "'") // Smart quotes → regular quotes
    .replace(/[""]/g, '"') // Smart quotes → regular quotes
    .replace(/[–—]/g, '-') // Em/en dash → hyphen
    // Remove ALL punctuation and special characters for fuzzy matching
    .replace(/[^\w\s]/g, ' ')
    // Normalize whitespace (multiple spaces to single)
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Get clean track name for comparison - strips remix info, features, etc.
 */
function getCleanTrackName(str: string): string {
  return str
    .toLowerCase()
    .trim()
    // Remove featuring artists
    .replace(/\s*\(?\s*feat\.?\s+.*?\)?/gi, '')
    .replace(/\s*\(?\s*featuring\s+.*?\)?/gi, '')
    // Remove remix/version info
    .replace(/\s*[-\(]\s*(original\s+mix|radio\s+edit|extended\s+mix|club\s+mix|remix|rmx|edit|rework|bootleg).*?[\)\s]*$/gi, '')
    // Remove punctuation
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract remix/version information
 */
function extractVersionInfo(title: string): {
  baseTitle: string;
  versionInfo: string;
  isRemix: boolean;
  isRadioEdit: boolean;
  isExtended: boolean;
  isVariation: boolean;
} {
  const normalized = normalizeString(title);
  
  // Common patterns for versions
  const remixPattern = /\((.*?(?:remix|rmx|mix|rework|bootleg|edit).*?)\)/i;
  const radioPattern = /\((.*?(?:radio|single).*?)\)/i;
  const extendedPattern = /\((.*?(?:extended|club|12"|original).*?)\)/i;
  const variationPattern = /\((.*?(?:variation|version|var\.|alt\.|alternate).*?)\)/i;
  const versionPattern = /\((.*?)\)/;
  
  let baseTitle = normalized;
  let versionInfo = '';
  
  // Extract version info from parentheses
  const match = normalized.match(versionPattern);
  if (match) {
    baseTitle = normalized.replace(match[0], '').trim();
    versionInfo = match[1];
  }
  
  return {
    baseTitle,
    versionInfo,
    isRemix: remixPattern.test(normalized),
    isRadioEdit: radioPattern.test(normalized),
    isExtended: extendedPattern.test(normalized),
    isVariation: variationPattern.test(normalized),
  };
}

/**
 * Check if album is a compilation
 */
function isCompilationAlbum(albumName: string): boolean {
  const lower = albumName.toLowerCase();
  const compilationKeywords = [
    'hits', 'best of', 'greatest', 'collection', 
    'various artists', 'compilation', 'anthology',
    'essential', 'ultimate', 'complete', 'definitive'
  ];
  
  return compilationKeywords.some(keyword => lower.includes(keyword));
}

/**
 * Calculate duration similarity with tolerance
 */
function durationSimilarity(spotifyMs: number, appleMs: number | string): number {
  const appleMsNum = typeof appleMs === 'string' ? parseInt(appleMs) : appleMs;
  const diffMs = Math.abs(spotifyMs - appleMsNum);
  const diffSeconds = diffMs / 1000;
  
  // Perfect match
  if (diffSeconds < 1) return 1.0;
  
  // Very close (1-3 seconds)
  if (diffSeconds < 3) return 0.95;
  
  // Close (3-5 seconds)
  if (diffSeconds < 5) return 0.85;
  
  // Acceptable (5-10 seconds)
  if (diffSeconds < 10) return 0.7;
  
  // Possibly different version (10-30 seconds)
  if (diffSeconds < 30) return 0.3;
  
  // Likely different version
  return 0.1;
}

/**
 * Calculate release date similarity
 */
function releaseDateSimilarity(spotifyDate?: string, appleDate?: string): number {
  if (!spotifyDate || !appleDate) return 0.5; // Neutral if missing
  
  const date1 = new Date(spotifyDate);
  const date2 = new Date(appleDate.split('T')[0]); // Handle ISO format
  
  const diffDays = Math.abs((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24));
  
  // Same day
  if (diffDays === 0) return 1.0;
  
  // Within a week (timezone/region differences)
  if (diffDays <= 7) return 0.9;
  
  // Within a month
  if (diffDays <= 30) return 0.7;
  
  // Within a year
  if (diffDays <= 365) return 0.5;
  
  // More than a year
  return 0.2;
}

/**
 * Main track matching algorithm
 */
export function matchTracks(
  spotifyTrack: SpotifyTrack,
  appleTracks: AppleTrack[],
  weights: MatchingWeights = DEFAULT_WEIGHTS
): {
  bestMatch: AppleTrack | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  allScores: MatchScore[];
  reason?: string;
} {
  console.log(`\n🎵 matchTracks called for: "${spotifyTrack.name}" by ${spotifyTrack.artists[0].name}`);
  console.log(`   Apple tracks to evaluate: ${appleTracks.length}`);
  
  if (!appleTracks || appleTracks.length === 0) {
    return { bestMatch: null, confidence: 'none', allScores: [], reason: 'No tracks to match' };
  }

  const spotifyVersion = extractVersionInfo(spotifyTrack.name);
  const spotifyArtistNorm = normalizeString(spotifyTrack.artists.map(a => a.name).join(', '));
  const spotifyAlbumNorm = normalizeString(spotifyTrack.album.name);
  const spotifyIsCompilation = isCompilationAlbum(spotifyTrack.album.name);

  // Check for high-confidence matches before complex scoring
  const spotifyClean = getCleanTrackName(spotifyTrack.name);
  const spotifyArtistClean = normalizeString(spotifyTrack.artists[0].name);
  
  for (const appleTrack of appleTracks) {
    const appleClean = getCleanTrackName(appleTrack.name);
    const appleArtistClean = normalizeString(appleTrack.artistName);
    
    // Duration match (within 2 seconds)
    const durationDiff = Math.abs(spotifyTrack.duration_ms - parseInt(appleTrack.durationMillis?.toString() || '0'));
    const durationMatch = durationDiff < 2000;
    
    // Fuzzy title match using Levenshtein distance
    const titleSimilarity = stringSimilarity(spotifyClean, appleClean);
    const titleMatch = titleSimilarity >= 0.85;
    
    // Fuzzy artist match using Levenshtein distance  
    const artistSimilarity = stringSimilarity(spotifyArtistClean, appleArtistClean);
    const artistMatch = artistSimilarity >= 0.75;
    
    if (titleMatch && artistMatch && durationMatch) {
      console.log(`Auto-selecting match: "${appleTrack.name}" by ${appleTrack.artistName}`);
      
      return {
        bestMatch: appleTrack,
        confidence: 'high',
        allScores: [{
          track: appleTrack,
          totalScore: 1.0,
          breakdown: {
            isrcMatch: 0,
            titleSimilarity: 1.0,
            artistSimilarity: 1.0,
            albumSimilarity: 0.8,
            durationSimilarity: 1.0,
            releaseDateSimilarity: 0.8,
            isCompilation: false,
            isRemixMatch: true,
          },
          confidence: 'high'
        }]
      };
    }
  }
  
  // Filter out inappropriate versions based on source track characteristics
  const spotifyLower = spotifyTrack.name.toLowerCase();
  const spotifyAlbumLower = spotifyTrack.album.name.toLowerCase();
  
  // Detect source track characteristics
  const spotifyIsDJMix = spotifyLower.includes('dj mix') || spotifyLower.includes('(mixed)') || 
                         spotifyAlbumLower.includes('dj mix') || spotifyAlbumLower.includes('(mixed)');
  const spotifyIsLive = spotifyLower.includes('live at') || spotifyLower.includes('live from') || 
                        spotifyLower.includes('(live)') || spotifyAlbumLower.includes('(live)');
  const spotifyIsAcoustic = spotifyLower.includes('acoustic') || spotifyLower.includes('unplugged');
  const spotifyIsInstrumental = spotifyLower.includes('instrumental');
  const spotifyIsAcapella = spotifyLower.includes('acapella') || spotifyLower.includes('a capella');
  const spotifyIsDemo = spotifyLower.includes('demo') || spotifyLower.includes('early version');
  const spotifyIsRadioEdit = spotifyLower.includes('radio edit') || spotifyLower.includes('radio mix');
  const spotifyHasSlash = spotifyTrack.name.includes(' / ');
  
  console.log(`\n🔍 Filtering ${appleTracks.length} Apple tracks for "${spotifyTrack.name}"`);
  
  const filteredTracks = appleTracks.filter(appleTrack => {
    const appleLower = appleTrack.name.toLowerCase();
    const appleAlbumLower = appleTrack.albumName.toLowerCase();
    
    // First, check if artist is even remotely similar
    const appleArtistClean = normalizeString(appleTrack.artistName);
    const artistSimilarity = stringSimilarity(spotifyArtistClean, appleArtistClean);
    
    if (artistSimilarity < 0.3) {
      console.log(`  ❌ Filtering out wrong artist: "${appleTrack.artistName}" (similarity: ${artistSimilarity.toFixed(2)})`);
      return false;
    }
    
    // DJ Mix filter - check both the lowercase and the original for [Mixed] tag
    const appleIsDJMix = appleLower.includes('(mixed)') || appleLower.includes('dj mix') ||
                         appleAlbumLower.includes('dj mix') || appleAlbumLower.includes('(mixed)') ||
                         appleAlbumLower.includes('edc las vegas') || appleAlbumLower.includes('kinetic field') ||
                         appleTrack.name.includes('[Mixed]') || appleTrack.name.includes('(Mixed)');
    if (!spotifyIsDJMix && appleIsDJMix) {
      console.log(`  ❌ Filtering out DJ mix: "${appleTrack.name}"`);
      return false;
    }
    
    // Multi-track mashup filter (tracks with " / " indicating two songs mixed)
    const appleHasSlash = appleTrack.name.includes(' / ');
    if (!spotifyHasSlash && appleHasSlash) {
      console.log(`  ❌ Filtering out mashup: "${appleTrack.name}"`);
      return false;
    }
    
    // Live version filter
    const appleIsLive = appleLower.includes('live at') || appleLower.includes('live from') || 
                        appleLower.includes('(live)') || appleAlbumLower.includes('(live)');
    if (!spotifyIsLive && appleIsLive) {
      console.log(`  ❌ Filtering out live version: "${appleTrack.name}"`);
      return false;
    }
    
    // Acoustic version filter
    const appleIsAcoustic = appleLower.includes('acoustic') || appleLower.includes('unplugged');
    if (!spotifyIsAcoustic && appleIsAcoustic) {
      console.log(`  ❌ Filtering out acoustic version: "${appleTrack.name}"`);
      return false;
    }
    
    // Instrumental filter
    const appleIsInstrumental = appleLower.includes('instrumental');
    if (!spotifyIsInstrumental && appleIsInstrumental) {
      console.log(`  ❌ Filtering out instrumental: "${appleTrack.name}"`);
      return false;
    }
    
    // Acapella filter
    const appleIsAcapella = appleLower.includes('acapella') || appleLower.includes('a capella');
    if (!spotifyIsAcapella && appleIsAcapella) {
      console.log(`  ❌ Filtering out acapella: "${appleTrack.name}"`);
      return false;
    }
    
    // Demo filter
    const appleIsDemo = appleLower.includes('demo') || appleLower.includes('early version');
    if (!spotifyIsDemo && appleIsDemo) {
      console.log(`  ❌ Filtering out demo: "${appleTrack.name}"`);
      return false;
    }
    
    // Radio edit filter - Radio edits are DIFFERENT versions (shorter, edited)
    const appleIsRadioEdit = appleLower.includes('radio edit') || appleLower.includes('radio mix');
    if (!spotifyIsRadioEdit && appleIsRadioEdit) {
      console.log(`  ❌ Filtering out radio edit: "${appleTrack.name}"`);
      return false;
    }
    
    return true;
  });
  
  // If filtering removed all options, use original list but with penalties
  const tracksToScore = filteredTracks.length > 0 ? filteredTracks : appleTracks;
  const didFilter = filteredTracks.length < appleTracks.length && filteredTracks.length > 0;
  
  console.log(`   After filtering: ${filteredTracks.length} tracks remain (filtered out ${appleTracks.length - filteredTracks.length})`);
  if (filteredTracks.length > 0) {
    console.log(`   Remaining tracks:`);
    filteredTracks.forEach(t => console.log(`     - "${t.name}" by ${t.artistName}`));
  }
  
  // Only if no obvious match found, do complex scoring
  const scores: MatchScore[] = tracksToScore.map(appleTrack => {
    const breakdown = {
      isrcMatch: 0,
      titleSimilarity: 0,
      artistSimilarity: 0,
      albumSimilarity: 0,
      durationSimilarity: 0,
      releaseDateSimilarity: 0,
      isCompilation: false,
      isRemixMatch: false,
    };

    // ISRC Match - Available from MusicKit API
    if (spotifyTrack.external_ids?.isrc && appleTrack.isrc) {
      breakdown.isrcMatch = spotifyTrack.external_ids.isrc === appleTrack.isrc ? 1.0 : 0.0;
      if (breakdown.isrcMatch === 1.0) {
        console.log(`  🎯 ISRC MATCH: ${spotifyTrack.external_ids.isrc}`);
      }
    } else {
      breakdown.isrcMatch = 0;
    }

    // Title Similarity
    const appleVersion = extractVersionInfo(appleTrack.name);
    
    // First check if featured artists are just in different places
    const spotifyHasFeaturedArtist = spotifyTrack.artists.length > 1;
    const appleHasFeatInTitle = appleTrack.name.match(/\((feat\.|featuring)\s+([^)]+)\)/i);
    
    if (spotifyHasFeaturedArtist && appleHasFeatInTitle) {
      // Extract featured artist from Apple title
      const featuredArtistMatch = appleHasFeatInTitle[2];
      
      // Check if any Spotify artist matches the featured artist in Apple title
      const featuredArtistMatches = spotifyTrack.artists.slice(1).some(artist => {
        const artistNorm = normalizeString(artist.name);
        const featNorm = normalizeString(featuredArtistMatch);
        return stringSimilarity(artistNorm, featNorm) >= 0.8;
      });
      
      if (featuredArtistMatches) {
        // Get base title similarity (ignoring the feat. part)
        const appleBaseTitle = appleTrack.name.replace(appleHasFeatInTitle[0], '').trim();
        const baseSim = stringSimilarity(spotifyTrack.name, appleBaseTitle);
        
        if (baseSim >= 0.85) {
          // Same track, just different featuring artist placement
          breakdown.titleSimilarity = 0.95;
          console.log(`  ✓ Featured artist "${featuredArtistMatch}" matches Spotify artist list`);
        } else {
          breakdown.titleSimilarity = baseSim;
        }
      } else {
        breakdown.titleSimilarity = stringSimilarity(spotifyTrack.name, appleTrack.name);
      }
    } else if (spotifyVersion.isRemix !== appleVersion.isRemix) {
      breakdown.titleSimilarity = 0.2; // Low score for version mismatch
    } else if (spotifyVersion.isVariation || appleVersion.isVariation) {
      // Special handling for variations (like "Kurayamino Variation")
      const baseSim = stringSimilarity(spotifyVersion.baseTitle, appleVersion.baseTitle);
      if (baseSim > 0.85) {
        // Be lenient with variations as they're often the same recording
        breakdown.titleSimilarity = baseSim * 0.95;
      } else {
        breakdown.titleSimilarity = baseSim * 0.85;
      }
    } else if (spotifyVersion.versionInfo && appleVersion.versionInfo) {
      // Both have version info - must match closely
      const versionSim = stringSimilarity(spotifyVersion.versionInfo, appleVersion.versionInfo);
      const baseSim = stringSimilarity(spotifyVersion.baseTitle, appleVersion.baseTitle);
      breakdown.titleSimilarity = (baseSim * 0.7) + (versionSim * 0.3);
    } else if (!spotifyVersion.versionInfo && appleVersion.versionInfo) {
      // Spotify has no version, Apple has version - prefer original mix
      const baseSim = stringSimilarity(spotifyVersion.baseTitle, appleVersion.baseTitle);
      const appleIsOriginal = appleVersion.versionInfo.toLowerCase().includes('original mix');
      const appleIsRadio = appleVersion.isRadioEdit;
      
      if (appleIsOriginal) {
        // Prefer original mix when Spotify has no version
        breakdown.titleSimilarity = baseSim * 0.95;
      } else if (appleIsRadio && !spotifyIsRadioEdit) {
        // Slightly penalize radio edits unless Spotify is also radio edit
        breakdown.titleSimilarity = baseSim * 0.85;
      } else {
        breakdown.titleSimilarity = baseSim * 0.8;
      }
    } else {
      // Standard title comparison
      breakdown.titleSimilarity = stringSimilarity(spotifyTrack.name, appleTrack.name);
    }

    breakdown.isRemixMatch = spotifyVersion.isRemix === appleVersion.isRemix;

    // Artist Similarity - handle multi-artist tracks better
    const appleArtistNorm = normalizeString(appleTrack.artistName);
    const spotifyPrimaryArtist = normalizeString(spotifyTrack.artists[0].name);
    
    // Extract main artist from strings like "BT with Tsunami One" or "BT feat. X"
    const extractMainArtist = (artist: string): string => {
      const normalized = normalizeString(artist);
      // Split on common featuring indicators
      const splits = normalized.split(/\s+(with|feat|featuring|ft|and|x|vs)\s+/i);
      return splits[0].trim();
    };
    
    const spotifyMainArtist = extractMainArtist(spotifyPrimaryArtist);
    const appleMainArtist = extractMainArtist(appleArtistNorm);
    
    // Try different approaches
    const fullArtistSim = stringSimilarity(spotifyArtistNorm, appleArtistNorm);
    const primaryArtistSim = stringSimilarity(spotifyPrimaryArtist, appleArtistNorm);
    const mainArtistSim = stringSimilarity(spotifyMainArtist, appleMainArtist);
    
    // Check if featuring artists are in different places
    const spotifyHasFeatInArtist = spotifyPrimaryArtist.match(/\s+(with|feat|ft)\s+/i) || 
                                   spotifyTrack.artists.length > 1;
    const appleHasFeatInTitleArtist = appleTrack.name.match(/\s*\((feat|ft)\./i);
    
    if (mainArtistSim >= 0.9) {
      // Main artists match perfectly (e.g., "BT" matches "BT")
      breakdown.artistSimilarity = 0.95;
    } else if (spotifyHasFeatInArtist && appleHasFeatInTitleArtist && mainArtistSim >= 0.8) {
      // Common pattern: Spotify lists as "Artist with X", Apple shows "Artist" + "(feat. X)" in title
      breakdown.artistSimilarity = 0.9;
    } else {
      // Use the best similarity score
      breakdown.artistSimilarity = Math.max(fullArtistSim, primaryArtistSim, mainArtistSim * 0.95);
    }

    // Album Similarity
    const appleAlbumNorm = normalizeString(appleTrack.albumName);
    const baseAlbumSim = stringSimilarity(spotifyAlbumNorm, appleAlbumNorm);
    
    // Special handling for soundtrack albums
    const appleAlbumLower = appleTrack.albumName.toLowerCase();
    const spotifyAlbumLower = spotifyTrack.album.name.toLowerCase();
    
    const appleIsSoundtrack = appleAlbumLower.includes('soundtrack') || 
                              appleAlbumLower.includes('motion picture') ||
                              appleAlbumLower.includes('music from') ||
                              appleAlbumLower.includes('ost');
    
    const spotifyIsSoundtrack = spotifyAlbumLower.includes('soundtrack') || 
                                spotifyAlbumLower.includes('motion picture') ||
                                spotifyAlbumLower.includes('music from') ||
                                spotifyAlbumLower.includes('ost');
    
    // If one is soundtrack and other isn't, but track/artist match well, reduce album penalty
    if ((appleIsSoundtrack && !spotifyIsSoundtrack) || (!appleIsSoundtrack && spotifyIsSoundtrack)) {
      if (breakdown.titleSimilarity >= 0.9 && breakdown.artistSimilarity >= 0.8) {
        // This is likely the same track, just different album release
        breakdown.albumSimilarity = Math.max(baseAlbumSim, 0.5);
        console.log(`  📀 Soundtrack/Album mismatch detected, adjusting album similarity`);
      } else {
        breakdown.albumSimilarity = baseAlbumSim;
      }
    } else {
      breakdown.albumSimilarity = baseAlbumSim;
    }
    
    // Check compilation status
    breakdown.isCompilation = isCompilationAlbum(appleTrack.albumName);
    
    // Heavily penalize compilation albums if source isn't a compilation
    if (!spotifyIsCompilation && breakdown.isCompilation) {
      breakdown.albumSimilarity *= 0.3; // Strong penalty for compilations
    }
    
    // Also penalize "best of", "greatest hits", etc.
    const isAppleGreatestHits = appleAlbumLower.includes('greatest hits') || 
                                appleAlbumLower.includes('best of') ||
                                appleAlbumLower.includes('essential') ||
                                appleAlbumLower.includes('collection');
    if (!spotifyIsCompilation && isAppleGreatestHits) {
      breakdown.albumSimilarity *= 0.3;
    }

    // Duration Similarity
    breakdown.durationSimilarity = durationSimilarity(spotifyTrack.duration_ms, appleTrack.durationMillis);

    // Release Date Similarity
    breakdown.releaseDateSimilarity = releaseDateSimilarity(
      spotifyTrack.album.release_date,
      appleTrack.releaseDate
    );

    // Calculate weighted total score
    const totalScore = 
      (breakdown.isrcMatch * weights.isrc) +
      (breakdown.titleSimilarity * weights.title) +
      (breakdown.artistSimilarity * weights.artist) +
      (breakdown.albumSimilarity * weights.album) +
      (breakdown.durationSimilarity * weights.duration) +
      (breakdown.releaseDateSimilarity * weights.releaseDate);

    // Determine confidence level
    let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';
    
    if (breakdown.isrcMatch === 1.0) {
      confidence = 'high'; // ISRC match is definitive
    } else if (totalScore >= 0.85) {
      confidence = 'high';
    } else if (totalScore >= 0.70) {
      confidence = 'medium';
    } else if (totalScore >= 0.50) {
      confidence = 'low';
    }

    return {
      track: appleTrack,
      totalScore,
      breakdown,
      confidence,
    };
  });

  // Sort by score, but prefer non-radio edits when scores are close
  scores.sort((a, b) => {
    const scoreDiff = b.totalScore - a.totalScore;
    
    // If scores are very close (within 5%), prefer original over radio edit
    if (Math.abs(scoreDiff) < 0.05) {
      const aIsRadio = a.track.name.toLowerCase().includes('radio edit') || 
                       a.track.name.toLowerCase().includes('radio mix');
      const bIsRadio = b.track.name.toLowerCase().includes('radio edit') || 
                       b.track.name.toLowerCase().includes('radio mix');
      
      // If one is radio and other isn't, prefer non-radio
      if (aIsRadio && !bIsRadio) return 1;
      if (!aIsRadio && bIsRadio) return -1;
    }
    
    return scoreDiff;
  });

  const topScore = scores[0];
  
  // Determine if we should auto-select
  if (!topScore) {
    return { bestMatch: null, confidence: 'none', allScores: scores };
  }

  // Auto-select criteria - be more aggressive
  if (topScore.breakdown.isrcMatch === 1.0) {
    // ISRC match is definitive (but we don't have this from iTunes)
    return { bestMatch: topScore.track, confidence: 'high', allScores: scores };
  }

  // Check for high-confidence matches
  const highConfidenceMatch = topScore.breakdown.titleSimilarity >= 0.95 && 
                             topScore.breakdown.durationSimilarity >= 0.95 &&
                             (topScore.breakdown.albumSimilarity >= 0.50 || topScore.breakdown.artistSimilarity >= 0.50);

  if (highConfidenceMatch) {
    console.log(`Auto-selecting high confidence match: ${topScore.track.name}`);
    return { bestMatch: topScore.track, confidence: 'high', allScores: scores };
  }

  // Title and duration match
  const titleDurationMatch = topScore.breakdown.titleSimilarity >= 0.95 && 
                            topScore.breakdown.durationSimilarity >= 0.95;

  if (titleDurationMatch) {
    console.log(`Auto-selecting title + duration match: ${topScore.track.name}`);
    return { bestMatch: topScore.track, confidence: 'high', allScores: scores };
  }

  // Check for album + duration + artist match
  const albumMatch = topScore.breakdown.albumSimilarity >= 0.95 && 
                    topScore.breakdown.durationSimilarity >= 0.90 &&
                    topScore.breakdown.artistSimilarity >= 0.50;

  if (albumMatch) {
    console.log(`Auto-selecting album match: ${topScore.track.name}`);
    return { bestMatch: topScore.track, confidence: 'high', allScores: scores };
  }

  // Check for featured artist in different places pattern
  const spotifyHasMultipleArtists = spotifyTrack.artists.length > 1;
  const topHasFeatInTitle = topScore.track.name.match(/\((feat\.|featuring)\s+/i);
  
  if (spotifyHasMultipleArtists && topHasFeatInTitle && topScore.totalScore >= 0.65) {
    console.log(`  ✅ Auto-selecting featured artist match: "${topScore.track.name}"`);
    return { bestMatch: topScore.track, confidence: 'high', allScores: scores };
  }
  
  // Lower confidence thresholds
  if (topScore.confidence === 'high' || topScore.totalScore >= 0.70) {
    // Check if significantly better than second best
    if (scores.length === 1 || topScore.totalScore > scores[1].totalScore * 1.15) {
      return { bestMatch: topScore.track, confidence: topScore.confidence, allScores: scores };
    }
  }
  
  // NEW: If we filtered tracks and only one remains, that's our match!
  console.log(`   Decision point: didFilter=${didFilter}, scores.length=${scores.length}, topScore=${topScore?.totalScore}`);
  if (didFilter && scores.length === 1) {
    console.log(`   ✅ Auto-selecting only remaining track after filtering: "${topScore.track.name}"`);
    return { bestMatch: topScore.track, confidence: 'high', allScores: scores };
  }
  
  // Special case: Soundtrack tracks with variations
  if (didFilter && scores.length <= 3 && topScore.totalScore >= 0.55) {
    // Check if this is likely a soundtrack track
    const spotifyAlbumLower = spotifyTrack.album.name.toLowerCase();
    const isSoundtrack = spotifyAlbumLower.includes('soundtrack') || 
                        spotifyAlbumLower.includes('motion picture') ||
                        spotifyAlbumLower.includes('original score') ||
                        spotifyAlbumLower.includes('ost');
    
    // Check if the Spotify track has a variation/version in parentheses
    const hasVariation = spotifyTrack.name.includes('(') && spotifyTrack.name.includes(')');
    
    if (isSoundtrack || hasVariation) {
      // Be more lenient with soundtrack tracks as they often have multiple versions
      console.log(`   ✅ Auto-selecting soundtrack/variation track: "${topScore.track.name}"`);
      return { bestMatch: topScore.track, confidence: 'medium', allScores: scores };
    }
  }
  
  // If we filtered out some tracks and top score is good, auto-select
  if (didFilter && topScore.totalScore >= 0.65) {
    console.log(`Auto-selecting after filtering: "${topScore.track.name}" (filtered out inappropriate versions)`);
    return { bestMatch: topScore.track, confidence: 'medium', allScores: scores };
  }

  if ((topScore.confidence === 'medium' || topScore.totalScore >= 0.60) && scores.length === 1) {
    // Only one match with medium confidence
    return { bestMatch: topScore.track, confidence: 'medium', allScores: scores };
  }

  // Not confident enough to auto-select
  return { 
    bestMatch: null, 
    confidence: 'none', 
    allScores: scores,
    reason: 'Multiple possible matches, manual selection required'
  };
}

/**
 * Get match recommendations for manual review
 */
export function getMatchRecommendations(scores: MatchScore[]): {
  recommended: AppleTrack | null;
  alternatives: AppleTrack[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const highConfidence = scores.filter(s => s.confidence === 'high');
  const mediumConfidence = scores.filter(s => s.confidence === 'medium');
  
  if (highConfidence.length > 1) {
    warnings.push('Multiple high-confidence matches found');
  }
  
  const topScore = scores[0];
  if (topScore && !topScore.breakdown.isRemixMatch) {
    warnings.push('Version mismatch: One is a remix/edit, the other is not');
  }
  
  if (topScore && topScore.breakdown.isCompilation) {
    warnings.push('Match is from a compilation album');
  }
  
  return {
    recommended: highConfidence[0]?.track || mediumConfidence[0]?.track || null,
    alternatives: scores.slice(1, 5).map(s => s.track),
    warnings,
  };
}