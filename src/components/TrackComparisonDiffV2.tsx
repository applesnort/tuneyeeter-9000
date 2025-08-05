"use client";

import { SuccessfulTransfer } from "@/types/transfer";
import { useState, useEffect } from "react";
import { matchTracks } from "@/lib/track-matching-algorithm";
import { MatchAnalysisCard } from "./MatchAnalysisCard";

interface TrackComparisonDiffV2Props {
  transfers: SuccessfulTransfer[];
}

export function TrackComparisonDiffV2({ transfers }: TrackComparisonDiffV2Props) {
  const [selectedTrack, setSelectedTrack] = useState<number>(0);
  const [loadingArtwork, setLoadingArtwork] = useState<{ [key: string]: boolean }>({});
  const [artworkSimilarity, setArtworkSimilarity] = useState<{ [key: string]: number | null }>({});
  const [matchScores, setMatchScores] = useState<{ [key: string]: any }>({});

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

  const formatDuration = (ms: number | string) => {
    const msNum = typeof ms === 'string' ? parseInt(ms) : ms;
    const seconds = Math.floor(msNum / 1000);
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

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600 font-semibold';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-orange-600';
      default: return 'text-red-600';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600';
    if (score >= 0.7) return 'text-green-500';
    if (score >= 0.5) return 'text-yellow-600';
    if (score >= 0.3) return 'text-orange-600';
    return 'text-red-600';
  };

  useEffect(() => {
    // Calculate match score for current track
    const current = transfers[selectedTrack];
    if (current) {
      const trackId = current.spotifyTrack.id;
      if (!matchScores[trackId]) {
        // Run the matching algorithm to get scores
        const result = matchTracks(current.spotifyTrack, [current.appleTrack]);
        if (result.allScores.length > 0) {
          setMatchScores(prev => ({ ...prev, [trackId]: result.allScores[0] }));
        }
      }
    }
  }, [selectedTrack, transfers, matchScores]);

  if (!transfers || transfers.length === 0) {
    return <div>No successful transfers to display</div>;
  }

  const current = transfers[selectedTrack];
  const spotifyTrack = current.spotifyTrack;
  const appleTrack = current.appleTrack;
  const trackId = spotifyTrack.id;
  const score = matchScores[trackId];

  // Auto-check artwork similarity when track is selected
  if (spotifyTrack.album.images?.[0]?.url && appleTrack.artworkUrl && !artworkSimilarity[trackId] && !loadingArtwork[trackId]) {
    checkArtworkSimilarity(spotifyTrack.album.images[0].url, appleTrack.artworkUrl, trackId);
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Track Comparison Diff (V2 Algorithm)</h2>
      
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

      {/* Match Score Summary */}
      {score && (
        <div className="mb-6">
          <MatchAnalysisCard 
            score={score} 
            spotifyTrack={spotifyTrack} 
            appleTrack={appleTrack} 
          />
        </div>
      )}

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
              <p className={`font-medium ${score?.breakdown.titleSimilarity === 1 ? 'text-green-600' : score?.breakdown.titleSimilarity > 0.8 ? 'text-yellow-600' : 'text-orange-600'}`}>
                {appleTrack.name}
              </p>
            </div>
            
            <div>
              <span className="text-sm text-gray-600">Artist(s):</span>
              <p className={`font-medium ${score?.breakdown.artistSimilarity === 1 ? 'text-green-600' : score?.breakdown.artistSimilarity > 0.8 ? 'text-yellow-600' : 'text-orange-600'}`}>
                {appleTrack.artistName}
              </p>
            </div>
            
            <div>
              <span className="text-sm text-gray-600">Album:</span>
              <p className={`font-medium ${score?.breakdown.albumSimilarity === 1 ? 'text-green-600' : score?.breakdown.albumSimilarity > 0.8 ? 'text-yellow-600' : 'text-orange-600'}`}>
                {appleTrack.albumName}
              </p>
            </div>
            
            <div>
              <span className="text-sm text-gray-600">Duration:</span>
              <p className="font-medium">
                {formatDuration(appleTrack.durationMillis)}
                <span className={`text-sm ml-2 ${getDurationDiff(spotifyTrack.duration_ms, appleTrack.durationMillis) === 'Perfect match' ? 'text-green-600' : 'text-gray-500'}`}>
                  ({getDurationDiff(spotifyTrack.duration_ms, appleTrack.durationMillis)})
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

    </div>
  );
}