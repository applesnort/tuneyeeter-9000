import { SpotifyTrack, AppleTrack } from '@/types/transfer';
import { stringSimilarity, normalizeString } from './string-utils';

interface UnavailabilityAnalysis {
  confidence: number; // 0-100
  reasons: string[];
  closestMatches: Array<{
    track: AppleTrack;
    similarity: number;
    differences: string[];
  }>;
  albumExistsElsewhere?: {
    confirmed: boolean;
    sources: string[];
    releaseYear?: string;
  };
}

/**
 * Analyze search results to determine confidence that a track is unavailable
 */
export function analyzeUnavailability(
  spotifyTrack: SpotifyTrack,
  searchResults: AppleTrack[],
  albumFound: boolean
): UnavailabilityAnalysis {
  const reasons: string[] = [];
  let confidence = 0;
  
  // Factor 1: Album availability (40% weight)
  if (!albumFound) {
    confidence += 40;
    reasons.push(`Album "${spotifyTrack.album.name}" not found in artist's discography`);
  }
  
  // Factor 2: Artist match quality (30% weight)
  const spotifyArtist = normalizeString(spotifyTrack.artists[0].name);
  const correctArtistResults = searchResults.filter(result => {
    const resultArtist = normalizeString(result.artistName);
    return stringSimilarity(spotifyArtist, resultArtist) >= 0.8;
  });
  
  if (searchResults.length > 0 && correctArtistResults.length === 0) {
    confidence += 30;
    reasons.push(`No results found for artist "${spotifyTrack.artists[0].name}"`);
  } else if (correctArtistResults.length < searchResults.length * 0.2) {
    confidence += 20;
    reasons.push('Most results are from different artists');
  }
  
  // Factor 3: Track name matches (20% weight)
  const trackNameMatches = searchResults.filter(result => {
    const spotifyName = normalizeString(spotifyTrack.name);
    const resultName = normalizeString(result.name);
    return stringSimilarity(spotifyName, resultName) >= 0.7;
  });
  
  if (searchResults.length > 0 && trackNameMatches.length === 0) {
    confidence += 20;
    reasons.push('No tracks with similar names found');
  }
  
  // Factor 4: Duration matches (10% weight)
  const durationMatches = searchResults.filter(result => {
    const spotifyDuration = spotifyTrack.duration_ms;
    const resultDuration = typeof result.durationMillis === 'string' 
      ? parseInt(result.durationMillis) 
      : result.durationMillis;
    const diff = Math.abs(spotifyDuration - resultDuration);
    return diff < 30000; // Within 30 seconds
  });
  
  if (searchResults.length > 0 && durationMatches.length === 0) {
    confidence += 10;
    reasons.push('No tracks with similar duration found');
  }
  
  // Analyze closest matches
  const closestMatches = searchResults
    .map(result => {
      const differences: string[] = [];
      let similarity = 0;
      
      // Artist similarity (40% of similarity score)
      const artistSim = stringSimilarity(
        normalizeString(spotifyTrack.artists[0].name),
        normalizeString(result.artistName)
      );
      similarity += artistSim * 40;
      
      if (artistSim < 0.8) {
        differences.push(`Different artist: ${result.artistName}`);
      }
      
      // Track name similarity (30% of similarity score)
      const trackSim = stringSimilarity(
        normalizeString(spotifyTrack.name),
        normalizeString(result.name)
      );
      similarity += trackSim * 30;
      
      if (trackSim < 0.8) {
        const resultLower = result.name.toLowerCase();
        if (resultLower.includes('live')) differences.push('Live version');
        else if (resultLower.includes('remix')) differences.push('Remix version');
        else if (resultLower.includes('acoustic')) differences.push('Acoustic version');
        else if (resultLower.includes('extended')) differences.push('Extended version');
        else if (resultLower.includes('radio edit')) differences.push('Radio edit');
        else differences.push(`Different title: "${result.name}"`);
      }
      
      // Album similarity (20% of similarity score)
      const albumSim = stringSimilarity(
        normalizeString(spotifyTrack.album.name),
        normalizeString(result.albumName)
      );
      similarity += albumSim * 20;
      
      if (albumSim < 0.5) {
        differences.push(`Different album: "${result.albumName}"`);
      }
      
      // Duration similarity (10% of similarity score)
      const spotifyDuration = spotifyTrack.duration_ms;
      const resultDuration = typeof result.durationMillis === 'string' 
        ? parseInt(result.durationMillis) 
        : result.durationMillis;
      const durationDiff = Math.abs(spotifyDuration - resultDuration) / 1000; // seconds
      
      if (durationDiff < 5) {
        similarity += 10;
      } else if (durationDiff < 30) {
        similarity += 5;
        differences.push(`Duration differs by ${Math.round(durationDiff)}s`);
      } else {
        differences.push(`Very different duration (${Math.round(durationDiff)}s difference)`);
      }
      
      return {
        track: result,
        similarity: Math.round(similarity),
        differences
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5); // Top 5 closest matches
  
  return {
    confidence: Math.min(100, confidence),
    reasons,
    closestMatches
  };
}

