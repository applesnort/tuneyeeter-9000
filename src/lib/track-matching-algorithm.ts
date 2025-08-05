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
 * Normalize strings for comparison - AGGRESSIVE normalization for obvious matches
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
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
} {
  const normalized = normalizeString(title);
  
  // Common patterns for versions
  const remixPattern = /\((.*?(?:remix|rmx|mix|rework|bootleg|edit).*?)\)/i;
  const radioPattern = /\((.*?(?:radio|single).*?)\)/i;
  const extendedPattern = /\((.*?(?:extended|club|12"|original).*?)\)/i;
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
  
  // Only if no obvious match found, do complex scoring
  const scores: MatchScore[] = appleTracks.map(appleTrack => {
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

    // ISRC Match - NOT AVAILABLE from iTunes API
    // We keep this in the algorithm for future use if we get access to a better API
    // For now, this will always be 0
    breakdown.isrcMatch = 0;

    // Title Similarity
    const appleVersion = extractVersionInfo(appleTrack.name);
    
    // Check if version types match
    if (spotifyVersion.isRemix !== appleVersion.isRemix) {
      breakdown.titleSimilarity = 0.2; // Low score for version mismatch
    } else if (spotifyVersion.versionInfo && appleVersion.versionInfo) {
      // Both have version info - must match closely
      const versionSim = stringSimilarity(spotifyVersion.versionInfo, appleVersion.versionInfo);
      const baseSim = stringSimilarity(spotifyVersion.baseTitle, appleVersion.baseTitle);
      breakdown.titleSimilarity = (baseSim * 0.7) + (versionSim * 0.3);
    } else {
      // Standard title comparison
      breakdown.titleSimilarity = stringSimilarity(spotifyTrack.name, appleTrack.name);
    }

    breakdown.isRemixMatch = spotifyVersion.isRemix === appleVersion.isRemix;

    // Artist Similarity - handle multi-artist tracks better
    const appleArtistNorm = normalizeString(appleTrack.artistName);
    const spotifyPrimaryArtist = normalizeString(spotifyTrack.artists[0].name);
    
    // Try different approaches
    const fullArtistSim = stringSimilarity(spotifyArtistNorm, appleArtistNorm);
    const primaryArtistSim = stringSimilarity(spotifyPrimaryArtist, appleArtistNorm);
    
    // For tracks with features, Apple might only show primary artist
    const spotifyHasFeatures = spotifyTrack.name.toLowerCase().includes('feat') || 
                              spotifyTrack.artists.length > 1;
    
    if (spotifyHasFeatures && primaryArtistSim > 0.8) {
      // If primary artist matches well and Spotify has features, use primary similarity
      breakdown.artistSimilarity = primaryArtistSim;
    } else {
      // Use the better of the two similarities
      breakdown.artistSimilarity = Math.max(fullArtistSim, primaryArtistSim);
    }

    // Album Similarity
    const appleAlbumNorm = normalizeString(appleTrack.albumName);
    breakdown.albumSimilarity = stringSimilarity(spotifyAlbumNorm, appleAlbumNorm);
    
    // Check compilation status
    breakdown.isCompilation = isCompilationAlbum(appleTrack.albumName);
    if (spotifyIsCompilation !== breakdown.isCompilation) {
      breakdown.albumSimilarity *= 0.5; // Penalize compilation mismatches
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

  // Sort by score
  scores.sort((a, b) => b.totalScore - a.totalScore);

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

  // Lower confidence thresholds
  if (topScore.confidence === 'high' || topScore.totalScore >= 0.70) {
    // Check if significantly better than second best
    if (scores.length === 1 || topScore.totalScore > scores[1].totalScore * 1.15) {
      return { bestMatch: topScore.track, confidence: topScore.confidence, allScores: scores };
    }
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