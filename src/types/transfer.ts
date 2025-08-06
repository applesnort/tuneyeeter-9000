export interface SpotifyTrack {
  id?: string; // Made optional - some tracks (e.g., local files) might not have IDs
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
  uri?: string; // Also made optional as it might be missing too
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
  isrc?: string; // Available from MusicKit API, not iTunes API
}

export interface TransferFailure {
  spotifyTrack: SpotifyTrack;
  reason: 'not_found' | 'region_locked' | 'multiple_matches' | 'api_error' | 'album_not_available';
  details: string;
  suggestedAction: string;
  possibleMatches?: AppleTrack[];
  unavailableConfidence?: number; // 0-100 confidence that track is not available
  closestMatches?: Array<{
    track: AppleTrack;
    similarity: number; // 0-100 how similar this match is
    differences: string[]; // What's different (e.g., "Different artist", "Live version")
  }>;
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
  timing?: {
    overallTime: number;
    totalApiCalls: number;
    totalSearchTime: number;
    averageTimePerTrack: number;
    averageApiCallsPerTrack: number;
    trackTimings: Array<{
      trackName: string;
      searchTime: number;
      apiCalls: number;
      matchResult: string;
    }>;
  };
  metadata?: {
    isrcMatchCount?: number;
    usedMusicKit?: boolean;
  };
}