import { generateMusicKitToken } from './musickit-token';
import { SpotifyTrack, AppleTrack } from '@/types/transfer';

interface MusicKitSearchResult {
  data?: Array<{
    id: string;
    type: string;
    attributes: {
      name: string;
      artistName: string;
      albumName: string;
      durationInMillis: number;
      isrc?: string;
      artwork?: {
        url: string;
      };
      releaseDate?: string;
      url: string;
    };
  }>;
}

export async function searchMusicKitByISRC(isrc: string): Promise<AppleTrack[]> {
  try {
    const token = generateMusicKitToken();
    const url = `https://api.music.apple.com/v1/catalog/us/songs?filter[isrc]=${isrc}`;
    
    console.log(`Searching MusicKit for ISRC: ${isrc}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Music-User-Token': '', // This would be the user's token after they auth
      },
    });

    if (!response.ok) {
      console.error(`MusicKit API error: ${response.status}`);
      return [];
    }

    const data: MusicKitSearchResult = await response.json();
    
    if (!data.data || data.data.length === 0) {
      return [];
    }

    // Convert MusicKit format to our AppleTrack format
    return data.data.map(track => ({
      id: track.id,
      name: track.attributes.name,
      artistName: track.attributes.artistName,
      albumName: track.attributes.albumName,
      url: track.attributes.url,
      durationMillis: track.attributes.durationInMillis,
      artworkUrl: track.attributes.artwork?.url.replace('{w}x{h}', '600x600'),
      releaseDate: track.attributes.releaseDate,
      isrc: track.attributes.isrc,
    }));
  } catch (error) {
    console.error('MusicKit search error:', error);
    return [];
  }
}

export async function searchMusicKitByMetadata(track: SpotifyTrack): Promise<AppleTrack[]> {
  try {
    const token = generateMusicKitToken();
    
    // If we have ISRC, try that first
    if (track.external_ids?.isrc) {
      console.log(`Track has ISRC: ${track.external_ids.isrc}`);
      const isrcResults = await searchMusicKitByISRC(track.external_ids.isrc);
      if (isrcResults.length > 0) {
        console.log(`Found ${isrcResults.length} matches via ISRC!`);
        return isrcResults;
      }
    }
    
    // Otherwise, search by artist and track name
    const searchTerm = `${track.artists[0].name} ${track.name}`;
    const url = `https://api.music.apple.com/v1/catalog/us/search?term=${encodeURIComponent(searchTerm)}&types=songs&limit=25`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error(`MusicKit API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!data.results?.songs?.data) {
      return [];
    }

    return data.results.songs.data.map((track: any) => ({
      id: track.id,
      name: track.attributes.name,
      artistName: track.attributes.artistName,
      albumName: track.attributes.albumName,
      url: track.attributes.url,
      durationMillis: track.attributes.durationInMillis,
      artworkUrl: track.attributes.artwork?.url.replace('{w}x{h}', '600x600'),
      releaseDate: track.attributes.releaseDate,
      isrc: track.attributes.isrc,
    }));
  } catch (error) {
    console.error('MusicKit search error:', error);
    return [];
  }
}