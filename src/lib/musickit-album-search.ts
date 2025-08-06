import { generateMusicKitToken } from './musickit-token';
import { SpotifyTrack, AppleTrack } from '@/types/transfer';

interface MusicKitAlbum {
  id: string;
  type: string;
  attributes: {
    name: string;
    artistName: string;
    trackCount: number;
    releaseDate?: string;
    artwork?: {
      url: string;
    };
    url: string;
  };
}

interface MusicKitArtist {
  id: string;
  type: string;
  attributes: {
    name: string;
    url: string;
  };
  relationships?: {
    albums?: {
      data: MusicKitAlbum[];
    };
  };
}

/**
 * Search for an album directly using MusicKit
 */
export async function searchMusicKitAlbum(artistName: string, albumName: string): Promise<MusicKitAlbum | null> {
  try {
    const token = generateMusicKitToken();
    const searchTerm = `${artistName} ${albumName}`;
    const url = `https://api.music.apple.com/v1/catalog/us/search?term=${encodeURIComponent(searchTerm)}&types=albums&limit=25`;
    
    console.log(`Searching MusicKit for album: "${albumName}" by ${artistName}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.log(`MusicKit album search unavailable (401) - skipping to ISRC/iTunes search`);
      } else {
        console.error(`MusicKit album search error: ${response.status}`);
      }
      return null;
    }

    const data = await response.json();
    const albums = data.results?.albums?.data || [];
    
    // Find best matching album
    const normalizedArtist = artistName.toLowerCase().trim();
    const normalizedAlbum = albumName.toLowerCase().trim();
    
    for (const album of albums) {
      const albumArtist = album.attributes.artistName.toLowerCase().trim();
      const albumTitle = album.attributes.name.toLowerCase().trim();
      
      // Check for exact or very close matches
      if (albumArtist.includes(normalizedArtist) || normalizedArtist.includes(albumArtist)) {
        if (albumTitle === normalizedAlbum || 
            albumTitle.includes(normalizedAlbum) || 
            normalizedAlbum.includes(albumTitle)) {
          console.log(`  ✓ Found album match: "${album.attributes.name}" by ${album.attributes.artistName}`);
          return album;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('MusicKit album search failed:', error);
    return null;
  }
}

/**
 * Search for an artist and get their albums
 */
export async function searchMusicKitArtist(artistName: string): Promise<MusicKitArtist | null> {
  try {
    const token = generateMusicKitToken();
    const url = `https://api.music.apple.com/v1/catalog/us/search?term=${encodeURIComponent(artistName)}&types=artists&limit=10`;
    
    console.log(`Searching MusicKit for artist: "${artistName}"`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.log(`MusicKit artist search unavailable (401) - skipping to ISRC/iTunes search`);
      } else {
        console.error(`MusicKit artist search error: ${response.status}`);
      }
      return null;
    }

    const data = await response.json();
    const artists = data.results?.artists?.data || [];
    
    // Find best matching artist
    const normalizedSearch = artistName.toLowerCase().trim();
    
    for (const artist of artists) {
      const artistNameLower = artist.attributes.name.toLowerCase().trim();
      
      // Check for exact or very close matches
      if (artistNameLower === normalizedSearch || 
          artistNameLower.includes(normalizedSearch) || 
          normalizedSearch.includes(artistNameLower)) {
        console.log(`  ✓ Found artist match: "${artist.attributes.name}"`);
        return artist;
      }
    }
    
    return null;
  } catch (error) {
    console.error('MusicKit artist search failed:', error);
    return null;
  }
}

/**
 * Get all albums for a specific artist
 */
export async function getMusicKitArtistAlbums(artistId: string): Promise<MusicKitAlbum[]> {
  try {
    const token = generateMusicKitToken();
    const url = `https://api.music.apple.com/v1/catalog/us/artists/${artistId}/albums?limit=100`;
    
    console.log(`Getting albums for artist ID: ${artistId}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error(`MusicKit get albums error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error('MusicKit get albums failed:', error);
    return [];
  }
}

/**
 * Search for tracks within a specific album
 */
export async function getMusicKitAlbumTracks(albumId: string): Promise<AppleTrack[]> {
  try {
    const token = generateMusicKitToken();
    const url = `https://api.music.apple.com/v1/catalog/us/albums/${albumId}/tracks`;
    
    console.log(`Getting tracks for album ID: ${albumId}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error(`MusicKit get tracks error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    const tracks = data.data || [];
    
    // Convert to our AppleTrack format
    return tracks.map((track: any) => ({
      id: track.id,
      name: track.attributes.name,
      artistName: track.attributes.artistName,
      albumName: track.attributes.albumName,
      url: track.attributes.url,
      durationMillis: track.attributes.durationInMillis,
      artworkUrl: track.attributes.artwork?.url.replace('{w}', '600').replace('{h}', '600'),
      releaseDate: track.attributes.releaseDate,
      isrc: track.attributes.isrc || '',
    }));
  } catch (error) {
    console.error('MusicKit get tracks failed:', error);
    return [];
  }
}