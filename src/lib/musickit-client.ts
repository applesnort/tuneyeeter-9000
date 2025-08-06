// MusicKit JS v3 client wrapper
declare global {
  interface Window {
    MusicKit: any;
  }
}

export class MusicKitClient {
  private music: any;
  private isConfigured: boolean = false;

  async configure(developerToken: string) {
    if (this.isConfigured) return;

    // Wait for MusicKit JS to load
    await this.waitForMusicKit();

    try {
      this.music = window.MusicKit.configure({
        developerToken,
        app: {
          name: 'TuneYeeter 9000',
          build: '1.0.0',
        },
      });

      this.isConfigured = true;
      console.log('MusicKit configured successfully');
    } catch (error) {
      console.error('Failed to configure MusicKit:', error);
      throw error;
    }
  }

  private async waitForMusicKit(timeout = 10000): Promise<void> {
    const start = Date.now();
    
    while (!window.MusicKit) {
      if (Date.now() - start > timeout) {
        throw new Error('MusicKit JS failed to load');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async authorize(): Promise<string | null> {
    if (!this.isConfigured) {
      throw new Error('MusicKit not configured');
    }

    try {
      const musicUserToken = await this.music.authorize();
      console.log('User authorized successfully');
      return musicUserToken;
    } catch (error) {
      console.error('Authorization failed:', error);
      return null;
    }
  }

  async searchByISRC(isrc: string): Promise<any[]> {
    if (!this.music.isAuthorized) {
      throw new Error('User not authorized');
    }

    try {
      const response = await this.music.api.search({
        term: isrc,
        types: 'songs',
        filter: {
          'songs': {
            'isrc': isrc
          }
        }
      });

      return response.songs?.data || [];
    } catch (error) {
      console.error('ISRC search failed:', error);
      return [];
    }
  }

  async searchSongs(query: string, limit = 25): Promise<any[]> {
    if (!this.music.isAuthorized) {
      throw new Error('User not authorized');
    }

    try {
      const response = await this.music.api.search({
        term: query,
        types: 'songs',
        limit: limit
      });

      return response.songs?.data || [];
    } catch (error) {
      console.error('Song search failed:', error);
      return [];
    }
  }

  async createPlaylist(name: string, description?: string): Promise<any> {
    if (!this.music.isAuthorized) {
      throw new Error('User not authorized');
    }

    try {
      const response = await this.music.api.library.playlists.create({
        attributes: {
          name,
          description: description || `Created by TuneYeeter 9000 on ${new Date().toLocaleDateString()}`
        }
      });

      return response;
    } catch (error) {
      console.error('Failed to create playlist:', error);
      throw error;
    }
  }

  async addTracksToPlaylist(playlistId: string, trackIds: string[]): Promise<boolean> {
    if (!this.music.isAuthorized) {
      throw new Error('User not authorized');
    }

    try {
      // MusicKit expects track IDs in a specific format
      const tracks = trackIds.map(id => ({
        id,
        type: 'songs'
      }));

      await this.music.api.library.playlists.addTracks(playlistId, tracks);
      return true;
    } catch (error) {
      console.error('Failed to add tracks to playlist:', error);
      return false;
    }
  }

  async addTracksToLibrary(trackIds: string[]): Promise<boolean> {
    if (!this.music.isAuthorized) {
      throw new Error('User not authorized');
    }

    try {
      // Add songs to user's library
      await this.music.api.library.add({
        songs: trackIds
      });
      return true;
    } catch (error) {
      console.error('Failed to add tracks to library:', error);
      return false;
    }
  }

  isAuthorized(): boolean {
    return this.music?.isAuthorized || false;
  }

  async unauthorize(): Promise<void> {
    if (this.music) {
      await this.music.unauthorize();
    }
  }
}

// Singleton instance
export const musicKit = new MusicKitClient();