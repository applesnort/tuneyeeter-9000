# Visual Hash Matching for Album Artwork

## The Problem
Looking at the failed tracks, many have **visually identical album covers** between Spotify and Apple Music but failed text-based matching due to:
- Slight artist name differences (e.g., "feat." vs "featuring")
- Different track versions (radio edit, explicit, etc.)
- Punctuation variations
- Different album names for the same release

## Visual Hash Solution

### 1. Perceptual Hashing (pHash)
```typescript
import { createHash } from 'crypto';

async function generateImageHash(imageUrl: string): Promise<string> {
  // Download image
  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();
  
  // Generate perceptual hash (simplified - would use actual image processing)
  const hash = createHash('md5').update(Buffer.from(buffer)).digest('hex');
  return hash;
}

// Compare hashes
function compareImageHashes(hash1: string, hash2: string): number {
  // Hamming distance for perceptual hashes
  // Lower distance = more similar images
  return hammingDistance(hash1, hash2);
}
```

### 2. Integration with Matching Algorithm
```typescript
// Enhanced matching with visual hash
async function enhancedMatchTracks(
  spotifyTrack: SpotifyTrack,
  appleTracks: AppleTrack[]
): Promise<MatchResult> {
  
  // First try text-based matching
  const textMatch = matchTracks(spotifyTrack, appleTracks);
  
  if (textMatch.bestMatch && textMatch.confidence === 'high') {
    return textMatch; // Text match is good enough
  }
  
  // Fallback to visual matching for low-confidence matches
  if (spotifyTrack.album.images?.[0]) {
    const spotifyImageHash = await generateImageHash(spotifyTrack.album.images[0].url);
    
    for (const appleTrack of appleTracks) {
      if (appleTrack.artworkUrl) {
        const appleImageHash = await generateImageHash(appleTrack.artworkUrl);
        const similarity = compareImageHashes(spotifyImageHash, appleImageHash);
        
        // If images are very similar (low distance) + reasonable text similarity
        if (similarity < 5) { // Very low hamming distance
          const titleSim = stringSimilarity(spotifyTrack.name, appleTrack.name);
          if (titleSim > 0.7) {
            return {
              bestMatch: appleTrack,
              confidence: 'high',
              reason: 'Visual hash + title match'
            };
          }
        }
      }
    }
  }
  
  return textMatch;
}
```

### 3. Implementation Strategy

#### Phase 1: Hash Caching
```typescript
const imageHashCache = new Map<string, string>();

async function getCachedImageHash(imageUrl: string): Promise<string> {
  if (imageHashCache.has(imageUrl)) {
    return imageHashCache.get(imageUrl)!;
  }
  
  const hash = await generateImageHash(imageUrl);
  imageHashCache.set(imageUrl, hash);
  return hash;
}
```

#### Phase 2: Parallel Processing
```typescript
// Generate hashes for all images in parallel
const hashPromises = [
  ...spotifyTracks.map(t => t.album.images?.[0]?.url).filter(Boolean),
  ...appleTracks.map(t => t.artworkUrl).filter(Boolean)
].map(url => getCachedImageHash(url));

await Promise.all(hashPromises);
```

## Expected Impact

### Current Failed Matches That Would Be Fixed:
Looking at the failed tracks table, visual hash matching would likely catch:

1. **Same Album, Different Track Versions**
   - Spotify: "Track Name (Radio Edit)"
   - Apple: "Track Name (Explicit Version)"
   - **Same artwork** → Visual hash match!

2. **Artist Name Variations**
   - Spotify: "Artist feat. Guest"
   - Apple: "Artist featuring Guest"
   - **Same artwork** → Visual hash match!

3. **Compilation vs Original Album**
   - Same track, different album context
   - **Same artwork** → Visual hash match!

### Performance Considerations:
- **Cache image hashes** to avoid repeated downloads
- **Parallel hash generation** during search phase
- **Fallback strategy**: Only use visual matching when text matching fails
- **Rate limiting**: Respect image CDN limits

### Accuracy Improvement Estimate:
- **Current**: 46/57 tracks (80.7%)
- **With Visual Hash**: Likely 52-55/57 tracks (91-96%)
- **Improvement**: +10-15% success rate

## Implementation Priority:
1. **High Impact**: Many failed matches have identical artwork
2. **Medium effort**: Requires image processing library
3. **Low risk**: Only used as fallback when text matching fails

Visual hash matching would be a game-changer for catching the "obvious" matches that our text algorithm misses due to metadata variations.