export interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{
    name: string;
  }>;
  album: {
    name: string;
    release_date?: string;
    images?: Array<{
      height: number;
      url: string;
      width: number;
    }>;
  };
  duration_ms: number;
  external_ids?: {
    isrc?: string;
  };
  uri: string;
}

export interface AppleTrack {
  id: string;
  name: string;
  artistName: string;
  albumName: string;
  url: string;
  durationMillis: number | string; // Can be either from API
  artworkUrl?: string;
  releaseDate?: string;
  // Note: iTunes API does NOT provide ISRC codes
}

export interface TransferFailure {
  spotifyTrack: SpotifyTrack;
  reason: 'not_found' | 'region_locked' | 'multiple_matches' | 'api_error';
  details: string;
  suggestedAction: string;
  possibleMatches?: AppleTrack[];
}

export interface SuccessfulTransfer {
  spotifyTrack: SpotifyTrack;
  appleTrack: AppleTrack;
}

export interface TransferResult {
  playlistName: string;
  totalTracks: number;
  successfulTransfers: number;
  successful: SuccessfulTransfer[];
  failures: TransferFailure[];
  transferDate: string;
  spotifyPlaylistUrl: string;
  applePlaylistUrl?: string;
}