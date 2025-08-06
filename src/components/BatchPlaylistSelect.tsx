"use client";

import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Music, Search, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";

interface Playlist {
  id: string;
  name: string;
  tracks: {
    total: number;
  };
  images?: Array<{
    url: string;
  }>;
  owner?: {
    display_name: string;
  };
}

interface BatchPlaylistSelectProps {
  onTransfer: (playlistIds: string[]) => void;
  maxPlaylists?: number;
}

export function BatchPlaylistSelect({ onTransfer, maxPlaylists = 5 }: BatchPlaylistSelectProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylists, setSelectedPlaylists] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<'name' | 'tracks' | 'recent'>('recent');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchPlaylists();
  }, []);

  const fetchPlaylists = async () => {
    try {
      const response = await fetch('/api/playlists');
      if (response.ok) {
        const data = await response.json();
        setPlaylists(data);
      } else {
        toast.error('Failed to load playlists');
      }
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
      toast.error('Error loading playlists');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlaylist = (playlistId: string) => {
    setSelectedPlaylists(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playlistId)) {
        newSet.delete(playlistId);
      } else {
        if (newSet.size >= maxPlaylists) {
          toast.error(`You can only select up to ${maxPlaylists} playlists at once`);
          return prev;
        }
        newSet.add(playlistId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    const filtered = getFilteredPlaylists();
    const toSelect = filtered.slice(0, maxPlaylists);
    setSelectedPlaylists(new Set(toSelect.map(p => p.id)));
    if (filtered.length > maxPlaylists) {
      toast.info(`Selected first ${maxPlaylists} playlists`);
    }
  };

  const deselectAll = () => {
    setSelectedPlaylists(new Set());
  };

  const getFilteredPlaylists = () => {
    let filtered = playlists;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.owner?.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    switch (sortBy) {
      case 'name':
        filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'tracks':
        filtered = [...filtered].sort((a, b) => b.tracks.total - a.tracks.total);
        break;
      case 'recent':
        // Assuming they're already in recent order from the API
        break;
    }

    return filtered;
  };

  const handleTransfer = () => {
    if (selectedPlaylists.size === 0) {
      toast.error('Please select at least one playlist');
      return;
    }
    onTransfer(Array.from(selectedPlaylists));
  };

  const filteredPlaylists = getFilteredPlaylists();
  const totalTracks = Array.from(selectedPlaylists).reduce((total, playlistId) => {
    const playlist = playlists.find(p => p.id === playlistId);
    return total + (playlist?.tracks.total || 0);
  }, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-6 border-b">
        <h2 className="text-2xl font-bold mb-4">Select Playlists to Transfer</h2>
        
        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search playlists..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Filters & Sorting
          </button>

          {showFilters && (
            <div className="flex gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-1 border rounded-md text-sm"
                >
                  <option value="recent">Recently Added</option>
                  <option value="name">Name (A-Z)</option>
                  <option value="tracks">Track Count</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={selectAll}
                  className="text-sm px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md"
                >
                  Select All (up to {maxPlaylists})
                </button>
                <button
                  onClick={deselectAll}
                  className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md"
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Playlist Grid */}
      <div className="p-6 max-h-96 overflow-y-auto">
        {filteredPlaylists.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchTerm ? 'No playlists match your search' : 'No playlists found'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPlaylists.map((playlist) => (
              <label
                key={playlist.id}
                className={`
                  flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer
                  transition-all hover:shadow-md
                  ${selectedPlaylists.has(playlist.id) 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                <Checkbox
                  checked={selectedPlaylists.has(playlist.id)}
                  onCheckedChange={() => togglePlaylist(playlist.id)}
                  className="flex-shrink-0"
                />
                
                <div className="flex gap-3 flex-1 min-w-0">
                  {playlist.images?.[0] ? (
                    <img
                      src={playlist.images[0].url}
                      alt={playlist.name}
                      className="w-12 h-12 rounded object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <Music className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{playlist.name}</p>
                    <p className="text-sm text-gray-600">
                      {playlist.tracks.total} tracks
                      {playlist.owner?.display_name && ` • ${playlist.owner.display_name}`}
                    </p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              {selectedPlaylists.size} playlist{selectedPlaylists.size !== 1 ? 's' : ''} selected
            </p>
            {selectedPlaylists.size > 0 && (
              <p className="text-sm text-gray-600">
                {totalTracks} total tracks to transfer
              </p>
            )}
          </div>
          
          <button
            onClick={handleTransfer}
            disabled={selectedPlaylists.size === 0}
            className={`
              px-6 py-2 rounded-lg font-medium transition-colors
              ${selectedPlaylists.size > 0
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            Transfer {selectedPlaylists.size > 0 && `(${selectedPlaylists.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}