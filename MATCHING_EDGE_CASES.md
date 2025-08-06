# Music Track Matching Edge Cases

This document outlines all the edge cases handled by the music transfer matching algorithm and provides guidance for handling additional scenarios.

## Current Edge Cases Handled

### 1. Artist Name Variations

#### Featured Artists in Different Locations
- **Pattern**: Spotify lists as artist field, Apple puts in title
- **Example**: 
  - Spotify: "BT with Tsunami One, Tsunami One"
  - Apple: "BT" with title "(feat. Tsunami One)"
- **Solution**: Extract main artist and compare, give high score if main artists match

#### Collaboration Indicators
- **Patterns Handled**: 
  - "with", "feat", "featuring", "ft", "and", "x", "vs"
- **Example**: "Artist A with Artist B" → "Artist A feat. Artist B"
- **Solution**: Split on collaboration keywords and compare main artist

### 2. Track Version Variations

#### DJ Mixes
- **Pattern**: Track includes "(Mixed)" or "DJ Mix" in title/album
- **Example**: "Angel on My Shoulder (Mixed)" 
- **Solution**: Filter out unless source track is also a DJ mix

#### Radio Edits
- **Pattern**: Shorter versions edited for radio play
- **Example**: "Beautiful (Radio Edit)"
- **Solution**: Filter out unless source track is also a radio edit

#### Extended/Club Versions
- **Pattern**: Longer versions for DJs/clubs
- **Example**: "Beautiful (Extended Mix)"
- **Solution**: Filter out unless source track is extended

#### Live Versions
- **Pattern**: Live recordings
- **Example**: "Song Title (Live at Madison Square Garden)"
- **Solution**: Filter out unless source track is live

#### Acoustic Versions
- **Pattern**: Acoustic arrangements
- **Example**: "Song Title (Acoustic)"
- **Solution**: Filter out unless source track is acoustic

#### Instrumental/Acapella
- **Pattern**: Vocals-only or instruments-only versions
- **Solution**: Filter out unless source track matches

#### Demo Versions
- **Pattern**: Early/rough versions
- **Example**: "Song Title (Demo)"
- **Solution**: Filter out unless source track is demo

#### Variations
- **Pattern**: Specific named variations
- **Example**: "Clubbed to Death (Kurayamino Variation)"
- **Solution**: Be lenient with matching when variation names present

### 3. Album-Related Issues

#### Album Not Available on Platform
- **Pattern**: Artist exists but specific album missing
- **Example**: "Way Out West" album by Way Out West
- **Solution**: 
  1. Check artist discography
  2. Validate with external sources (MusicBrainz, Discogs)
  3. Report with high confidence if confirmed to exist elsewhere

#### Compilation Albums
- **Pattern**: Greatest hits, best of, various artists
- **Solution**: Penalize but don't filter completely

#### Soundtrack Albums
- **Pattern**: Motion picture soundtracks, OSTs
- **Example**: "The Matrix (Music from the Motion Picture)"
- **Solution**: Lower confidence threshold for auto-matching

#### Tracks on Different Album Types
- **Pattern**: Same track appears on artist album AND soundtrack
- **Example**: "P.E.T.R.O.L." by Orbital appears on "Pi" soundtrack but Spotify shows it on an Orbital album
- **Solution**: 
  1. When album not found, search for track in soundtracks
  2. Reduce album similarity penalty when track/artist match well
  3. Search multiple variations: "track soundtrack", "track motion picture"

#### Different Album Versions
- **Pattern**: International, deluxe, remastered editions
- **Example**: "TRON: Legacy (International Version)"
- **Solution**: Check if track exists even if exact album version doesn't

### 4. Metadata Inconsistencies

#### ISRC Mismatches
- **Pattern**: Same ISRC points to different versions
- **Example**: ISRC points to "Extended Mix" when searching for original
- **Solution**: Still search other sources if ISRC match is wrong version

#### Duration Differences
- **Pattern**: Same track with slightly different durations
- **Solution**: Allow up to 30 seconds difference

#### Special Characters
- **Pattern**: Different unicode normalization, smart quotes
- **Example**: "don't" vs "don't"
- **Solution**: Normalize to NFC form, replace smart punctuation

### 5. Multi-Track Issues

#### Mashups/Medleys
- **Pattern**: Multiple tracks combined with "/"
- **Example**: "Track A / Track B (Mixed)"
- **Solution**: Filter out multi-track mashups unless source has slash

## Additional Edge Cases from Research

### 1. ISRC-Related Issues

#### Multiple ISRCs for Same Recording
- **Pattern**: Historical tracks with different ISRCs from remasters/reissues
- **Example**: Original 1970s recording has different ISRC than 2020 remaster
- **Recommendation**: Check audio fingerprinting or duration + artist + title
- **Implementation**: Fall back to fuzzy matching when ISRC differs

#### Missing ISRCs
- **Pattern**: Self-published tracks without ISRCs
- **Example**: Independent artists who didn't apply for ISRCs
- **Recommendation**: Rely more heavily on other metadata
- **Implementation**: Increase weight of title/artist/album matching

#### ISRC Reuse Issues
- **Pattern**: Same ISRC used for different versions
- **Example**: Label reuses ISRC for radio edit and album version
- **Recommendation**: Always verify with duration and title
- **Implementation**: Never rely solely on ISRC match

### 2. Platform-Specific Formatting

#### Artist ID Conflicts
- **Pattern**: Spotify and Apple Music use different unique Artist IDs
- **Example**: Same artist has different IDs on each platform
- **Recommendation**: Use artist name matching as primary method
- **Implementation**: Store platform-specific IDs for known artists

#### Featuring Artist Placement
- **Pattern**: Inconsistent placement of featured artists
- **Examples**:
  - Spotify: "Artist A, Artist B" in artist field
  - Apple: "Artist A" in artist field, "(feat. Artist B)" in title
  - Tidal: "Artist A feat. Artist B" in artist field
- **Recommendation**: Parse and normalize all formats
- **Implementation**: Already handled in current algorithm

#### Metadata Consistency Requirements
- **Pattern**: Apple Music's strict consistency requirements
- **Example**: Cannot change any metadata for re-releases
- **Recommendation**: Cache successful matches for future use
- **Implementation**: Build match history database

## Potential Additional Edge Cases

### 1. Regional Variations

#### Censored/Explicit Versions
- **Pattern**: Clean vs explicit versions
- **Recommendation**: Check explicit flags, prefer matching explicit status
- **Implementation**: Add `isExplicit` check to matching algorithm

#### Regional Exclusive Tracks
- **Pattern**: Tracks only available in certain countries
- **Recommendation**: Check `available_markets` field
- **Implementation**: Add region checking with user's location

### 2. Classical Music Special Cases

#### Movement Notation
- **Pattern**: "Symphony No. 5 in C Minor, Op. 67: I. Allegro con brio"
- **Recommendation**: Parse movement numbers and opus numbers separately
- **Implementation**: Special parser for classical track titles

#### Multiple Performers
- **Pattern**: "Performer, Conductor, Orchestra"
- **Recommendation**: Hierarchical artist matching
- **Implementation**: Weight primary performer higher

### 3. Remix Chains

#### Remix of Remix
- **Pattern**: "Track (Artist B Remix) (Artist C Re-edit)"
- **Recommendation**: Parse nested remix information
- **Implementation**: Recursive version parsing

### 4. Language Variations

#### Translated Titles
- **Pattern**: Same song with titles in different languages
- **Recommendation**: Use ISRC when available, check duration match
- **Implementation**: Add language detection and translation API

#### Romanization Differences
- **Pattern**: "Björk" vs "Bjork", Japanese/Korean romanization
- **Recommendation**: Normalize to ASCII for comparison
- **Implementation**: Add transliteration library

### 5. Time-Related Issues

#### Re-recordings
- **Pattern**: "Track Title (Taylor's Version)"
- **Recommendation**: Treat as different track unless specified
- **Implementation**: Add re-recording detection

#### Anniversary Editions
- **Pattern**: "Track Title (25th Anniversary Remaster)"
- **Recommendation**: Match if no other version available
- **Implementation**: Parse anniversary markers

## Best Practices

### 1. Confidence Scoring
- Use graduated confidence levels (high/medium/low)
- Combine multiple signals (title, artist, album, duration, ISRC)
- Allow manual override for edge cases

### 2. User Feedback Loop
- Track which manual selections users make
- Adjust algorithm based on common corrections
- Allow users to report matching issues

### 3. External Validation
- Use multiple music databases (MusicBrainz, Discogs, Last.fm)
- Cache external lookups to reduce API calls
- Fallback gracefully when external services fail

### 4. Performance Optimization
- Implement fuzzy search indexes
- Cache normalized strings
- Batch API requests where possible

### 5. Transparency
- Show users why matches failed
- Explain confidence scores
- Provide alternative options

## Implementation Priority

1. **High Priority** (Commonly encountered)
   - Featured artist handling
   - Radio edit/extended version filtering
   - Album availability checking

2. **Medium Priority** (Occasional issues)
   - Regional variations
   - Classical music formatting
   - Re-recordings

3. **Low Priority** (Rare edge cases)
   - Multi-language support
   - Complex remix chains
   - Anniversary editions

## Testing Strategy

1. **Unit Tests**: Each edge case should have dedicated tests
2. **Integration Tests**: Test combinations of edge cases
3. **Real-world Playlists**: Use diverse playlists for testing
4. **User Feedback**: Beta test with users who have large libraries

## Monitoring and Metrics

Track the following metrics:
- Match success rate by edge case type
- Most common manual corrections
- False positive/negative rates
- API response times and failures

## Additional Best Practices from Industry Research

### 1. ISRC Handling
- **Never trust ISRC alone**: Always verify with other metadata
- **Handle missing ISRCs gracefully**: Many independent releases lack them
- **Account for ISRC reuse**: Labels sometimes incorrectly reuse ISRCs

### 2. Platform Differences
- **Build platform-specific parsers**: Each service formats metadata differently
- **Cache successful mappings**: Reduce API calls and improve consistency
- **Handle artist ID systems**: Spotify and Apple use different unique IDs

### 3. Metadata Quality
- **Validate against multiple sources**: Cross-reference MusicBrainz, Discogs, etc.
- **Handle historical releases**: Pre-digital era tracks have inconsistent metadata
- **Account for human error**: Typos, formatting inconsistencies are common

### 4. User Experience
- **Explain mismatches clearly**: Users need to understand why tracks didn't match
- **Provide manual override options**: Some edge cases require human judgment
- **Learn from user corrections**: Build feedback loops to improve algorithm

This documentation should be updated as new edge cases are discovered and handled.