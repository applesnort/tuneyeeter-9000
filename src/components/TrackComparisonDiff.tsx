"use client";

import { SuccessfulTransfer } from "@/types/transfer";
import { useState } from "react";

interface TrackComparisonDiffProps {
  transfers: SuccessfulTransfer[];
}

export function TrackComparisonDiff({ transfers }: TrackComparisonDiffProps) {
  const [selectedTrack, setSelectedTrack] = useState<number>(0);
  const [loadingArtwork, setLoadingArtwork] = useState<{ [key: string]: boolean }>({});
  const [artworkSimilarity, setArtworkSimilarity] = useState<{ [key: string]: number | null }>({});

  const checkArtworkSimilarity = async (spotifyUrl: string, appleUrl: string, trackId: string) => {
    if (artworkSimilarity[trackId] !== undefined) return;
    
    setLoadingArtwork(prev => ({ ...prev, [trackId]: true }));
    
    try {
      const response = await fetch('/api/compare-artwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url1: spotifyUrl, url2: appleUrl }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setArtworkSimilarity(prev => ({ ...prev, [trackId]: data.similarity }));
      }
    } catch (error) {
      console.error('Artwork comparison failed:', error);
      setArtworkSimilarity(prev => ({ ...prev, [trackId]: null }));
    } finally {
      setLoadingArtwork(prev => ({ ...prev, [trackId]: false }));
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getDurationDiff = (spotifyMs: number, appleMs: number | string) => {
    const appleMsNum = typeof appleMs === 'string' ? parseInt(appleMs) : appleMs;
    const diff = Math.abs(spotifyMs - appleMsNum);
    const seconds = Math.floor(diff / 1000);
    if (seconds === 0) return "Perfect match";
    return `${seconds}s difference`;
  };

  const getSimilarityColor = (similarity: number | null | undefined) => {
    if (!similarity) return 'text-gray-500';
    if (similarity >= 90) return 'text-green-600 font-semibold';
    if (similarity >= 70) return 'text-green-500';
    if (similarity >= 50) return 'text-yellow-600';
    return 'text-red-500';
  };

  if (!transfers || transfers.length === 0) {
    return <div>No successful transfers to display</div>;
  }

  const current = transfers[selectedTrack];
  const spotifyTrack = current.spotifyTrack;
  const appleTrack = current.appleTrack;
  const trackId = spotifyTrack.id;

  // Auto-check artwork similarity when track is selected
  if (spotifyTrack.album.images?.[0]?.url && appleTrack.artworkUrl && !artworkSimilarity[trackId] && !loadingArtwork[trackId]) {
    checkArtworkSimilarity(spotifyTrack.album.images[0].url, appleTrack.artworkUrl, trackId);
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Track Comparison Diff</h2>
      
      {/* Track selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Track ({selectedTrack + 1} of {transfers.length})
        </label>
        <select
          value={selectedTrack}
          onChange={(e) => setSelectedTrack(Number(e.target.value))}
          className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          {transfers.map((transfer, idx) => (
            <option key={idx} value={idx}>
              {transfer.spotifyTrack.name} - {transfer.spotifyTrack.artists.map(a => a.name).join(", ")}
            </option>
          ))}
        </select>
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setSelectedTrack(Math.max(0, selectedTrack - 1))}
          disabled={selectedTrack === 0}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Previous
        </button>
        <button
          onClick={() => setSelectedTrack(Math.min(transfers.length - 1, selectedTrack + 1))}
          disabled={selectedTrack === transfers.length - 1}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next →
        </button>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Spotify Column */}
        <div className="border-r pr-6">
          <h3 className="text-lg font-semibold mb-4 text-green-600">Spotify</h3>
          
          {/* Artwork */}
          {spotifyTrack.album.images?.[0] && (
            <div className="mb-4">
              <img
                src={spotifyTrack.album.images[0].url}
                alt={`${spotifyTrack.album.name} cover`}
                className="w-full aspect-square object-cover rounded-lg shadow-md"
              />
            </div>
          )}

          {/* Track Info */}
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-600">Track:</span>
              <p className="font-medium">{spotifyTrack.name}</p>
            </div>
            
            <div>
              <span className="text-sm text-gray-600">Artist(s):</span>
              <p className="font-medium">{spotifyTrack.artists.map(a => a.name).join(", ")}</p>
            </div>
            
            <div>
              <span className="text-sm text-gray-600">Album:</span>
              <p className="font-medium">{spotifyTrack.album.name}</p>
            </div>
            
            <div>
              <span className="text-sm text-gray-600">Duration:</span>
              <p className="font-medium">{formatDuration(spotifyTrack.duration_ms)}</p>
            </div>
            
            {spotifyTrack.album.release_date && (
              <div>
                <span className="text-sm text-gray-600">Release Date:</span>
                <p className="font-medium">{spotifyTrack.album.release_date}</p>
              </div>
            )}
            
            {spotifyTrack.external_ids?.isrc && (
              <div>
                <span className="text-sm text-gray-600">ISRC:</span>
                <p className="font-medium font-mono text-xs">{spotifyTrack.external_ids.isrc}</p>
              </div>
            )}
            
            <div>
              <span className="text-sm text-gray-600">Spotify URI:</span>
              <p className="font-mono text-xs break-all">{spotifyTrack.uri}</p>
            </div>
          </div>
        </div>

        {/* Apple Music Column */}
        <div className="pl-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">Apple Music</h3>
          
          {/* Artwork */}
          {appleTrack.artworkUrl && (
            <div className="mb-4 relative">
              <img
                src={appleTrack.artworkUrl}
                alt={`${appleTrack.albumName} cover`}
                className="w-full aspect-square object-cover rounded-lg shadow-md"
              />
              
              {/* Artwork similarity badge */}
              <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1 shadow-md">
                {loadingArtwork[trackId] ? (
                  <span className="text-sm text-gray-500">Analyzing...</span>
                ) : (
                  <span className={`text-sm ${getSimilarityColor(artworkSimilarity[trackId])}`}>
                    {artworkSimilarity[trackId] ? `${artworkSimilarity[trackId].toFixed(1)}% match` : 'N/A'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Track Info */}
          <div className="space-y-2">
            <div>
              <span className="text-sm text-gray-600">Track:</span>
              <p className={`font-medium ${spotifyTrack.name === appleTrack.name ? 'text-green-600' : 'text-orange-600'}`}>
                {appleTrack.name}
              </p>
            </div>
            
            <div>
              <span className="text-sm text-gray-600">Artist(s):</span>
              <p className={`font-medium ${spotifyTrack.artists.map(a => a.name).join(", ") === appleTrack.artistName ? 'text-green-600' : 'text-orange-600'}`}>
                {appleTrack.artistName}
              </p>
            </div>
            
            <div>
              <span className="text-sm text-gray-600">Album:</span>
              <p className={`font-medium ${spotifyTrack.album.name === appleTrack.albumName ? 'text-green-600' : 'text-orange-600'}`}>
                {appleTrack.albumName}
              </p>
            </div>
            
            <div>
              <span className="text-sm text-gray-600">Duration:</span>
              <p className="font-medium">
                {formatDuration(parseInt(appleTrack.durationMillis.toString()))}
                <span className={`text-sm ml-2 ${getDurationDiff(spotifyTrack.duration_ms, parseInt(appleTrack.durationMillis.toString())) === 'Perfect match' ? 'text-green-600' : 'text-gray-500'}`}>
                  ({getDurationDiff(spotifyTrack.duration_ms, parseInt(appleTrack.durationMillis.toString()))})
                </span>
              </p>
            </div>
            
            {appleTrack.releaseDate && (
              <div>
                <span className="text-sm text-gray-600">Release Date:</span>
                <p className={`font-medium ${spotifyTrack.album.release_date === appleTrack.releaseDate.split('T')[0] ? 'text-green-600' : ''}`}>
                  {appleTrack.releaseDate.split('T')[0]}
                </p>
              </div>
            )}
            
            <div>
              <span className="text-sm text-gray-600">Apple Music ID:</span>
              <p className="font-medium font-mono text-xs">{appleTrack.id}</p>
            </div>
            
            <div>
              <span className="text-sm text-gray-600">Apple Music URL:</span>
              <a 
                href={appleTrack.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline text-xs break-all"
              >
                {appleTrack.url}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Match Summary */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-semibold mb-2">Match Analysis</h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Name Match:</span>
            <span className={`ml-2 font-medium ${spotifyTrack.name.toLowerCase() === appleTrack.name.toLowerCase() ? 'text-green-600' : 'text-orange-600'}`}>
              {spotifyTrack.name.toLowerCase() === appleTrack.name.toLowerCase() ? '✓ Exact' : '⚠ Different'}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Duration Match:</span>
            <span className={`ml-2 font-medium ${Math.abs(spotifyTrack.duration_ms - parseInt(appleTrack.durationMillis)) < 2000 ? 'text-green-600' : 'text-orange-600'}`}>
              {getDurationDiff(spotifyTrack.duration_ms, parseInt(appleTrack.durationMillis))}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Artwork Match:</span>
            <span className={`ml-2 font-medium ${getSimilarityColor(artworkSimilarity[trackId])}`}>
              {loadingArtwork[trackId] ? 'Checking...' : 
               artworkSimilarity[trackId] ? `${artworkSimilarity[trackId].toFixed(1)}%` : 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}