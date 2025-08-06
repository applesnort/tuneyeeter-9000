/**
 * External music database validators to confirm album/track existence
 */

interface AlbumValidation {
  exists: boolean;
  source: string;
  releaseYear?: string;
  label?: string;
  catalogNumber?: string;
  confidence: number;
}

/**
 * Search MusicBrainz database for album verification
 * MusicBrainz is a free, open music encyclopedia with extensive metadata
 */
export async function validateWithMusicBrainz(
  artistName: string,
  albumName: string
): Promise<AlbumValidation | null> {
  try {
    // MusicBrainz requires a User-Agent
    const userAgent = 'MusicTransferApp/1.0 (https://github.com/yourusername/music-transfer)';
    
    // Search for release groups (albums)
    const query = `artist:"${artistName}" AND release:"${albumName}"`;
    const url = `https://musicbrainz.org/ws/2/release-group/?query=${encodeURIComponent(query)}&fmt=json`;
    
    console.log(`Validating with MusicBrainz: "${albumName}" by ${artistName}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`MusicBrainz error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const releaseGroups = data['release-groups'] || [];
    
    // Find best match
    for (const group of releaseGroups) {
      const artistCredit = group['artist-credit']?.[0]?.name || '';
      const title = group.title || '';
      
      // Check if artist and album match reasonably well
      if (artistCredit.toLowerCase().includes(artistName.toLowerCase()) ||
          artistName.toLowerCase().includes(artistCredit.toLowerCase())) {
        if (title.toLowerCase() === albumName.toLowerCase() ||
            title.toLowerCase().includes(albumName.toLowerCase())) {
          
          return {
            exists: true,
            source: 'MusicBrainz',
            releaseYear: group['first-release-date']?.substring(0, 4),
            confidence: 95
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('MusicBrainz validation error:', error);
    return null;
  }
}

/**
 * Search Discogs database for album verification
 * Discogs is a user-built database of music information
 */
export async function validateWithDiscogs(
  artistName: string,
  albumName: string,
  apiKey?: string
): Promise<AlbumValidation | null> {
  try {
    // Discogs API requires authentication for better rate limits
    // For now, use public search endpoint
    const query = `${artistName} ${albumName}`;
    const url = `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release`;
    
    console.log(`Validating with Discogs: "${albumName}" by ${artistName}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MusicTransferApp/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`Discogs error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const results = data.results || [];
    
    // Find best match
    for (const release of results) {
      const title = release.title || '';
      // Discogs formats as "Artist - Album Title"
      const parts = title.split(' - ');
      
      if (parts.length >= 2) {
        const resultArtist = parts[0].trim();
        const resultAlbum = parts.slice(1).join(' - ').trim();
        
        if (resultArtist.toLowerCase().includes(artistName.toLowerCase()) ||
            artistName.toLowerCase().includes(resultArtist.toLowerCase())) {
          if (resultAlbum.toLowerCase() === albumName.toLowerCase() ||
              resultAlbum.toLowerCase().includes(albumName.toLowerCase())) {
            
            return {
              exists: true,
              source: 'Discogs',
              releaseYear: release.year,
              label: release.label?.[0],
              catalogNumber: release.catno,
              confidence: 90
            };
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Discogs validation error:', error);
    return null;
  }
}

/**
 * Search Last.fm for album verification
 * Last.fm has a comprehensive music database
 */
export async function validateWithLastFm(
  artistName: string,
  albumName: string,
  apiKey?: string
): Promise<AlbumValidation | null> {
  if (!apiKey) {
    console.log('Last.fm API key not provided, skipping validation');
    return null;
  }
  
  try {
    const url = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(artistName)}&album=${encodeURIComponent(albumName)}&format=json`;
    
    console.log(`Validating with Last.fm: "${albumName}" by ${artistName}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Last.fm error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.album) {
      return {
        exists: true,
        source: 'Last.fm',
        confidence: 85
      };
    }
    
    return null;
  } catch (error) {
    console.error('Last.fm validation error:', error);
    return null;
  }
}

/**
 * Validate album existence across multiple databases
 */
export async function validateAlbumExistence(
  artistName: string,
  albumName: string,
  options?: {
    discogsApiKey?: string;
    lastFmApiKey?: string;
  }
): Promise<{
  exists: boolean;
  confidence: number;
  sources: AlbumValidation[];
}> {
  const validations = await Promise.all([
    validateWithMusicBrainz(artistName, albumName),
    validateWithDiscogs(artistName, albumName, options?.discogsApiKey),
    validateWithLastFm(artistName, albumName, options?.lastFmApiKey)
  ]);
  
  const validResults = validations.filter(v => v !== null) as AlbumValidation[];
  const existingResults = validResults.filter(v => v.exists);
  
  if (existingResults.length === 0) {
    return {
      exists: false,
      confidence: 0,
      sources: validResults
    };
  }
  
  // Calculate overall confidence based on number of sources confirming
  const baseConfidence = Math.max(...existingResults.map(v => v.confidence));
  const bonusConfidence = (existingResults.length - 1) * 5; // +5% for each additional source
  
  return {
    exists: true,
    confidence: Math.min(100, baseConfidence + bonusConfidence),
    sources: existingResults
  };
}