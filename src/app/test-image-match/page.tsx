"use client";

import { useState } from "react";

export default function TestImageMatch() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [spotifyTrack, setSpotifyTrack] = useState<any>(null);
  const [appleTrack, setAppleTrack] = useState<any>(null);

  const testImageMatch = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      // Use the test endpoint
      console.log("Testing artwork comparison...");
      const response = await fetch("/api/test-artwork");

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to test artwork");
      }

      const data = await response.json();
      
      if (!data.spotifyTrack || !data.appleTrack) {
        throw new Error("Missing track data");
      }
      
      setSpotifyTrack(data.spotifyTrack);
      setAppleTrack(data.appleTrack);
      setResult(data.comparison);
      
      console.log("Test complete:", data);
    } catch (err) {
      console.error("Test error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Image Match Test</h1>
        
        <button
          onClick={testImageMatch}
          disabled={loading}
          className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Testing..." : "Test Image Match"}
        </button>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">Error: {error}</p>
          </div>
        )}

        {spotifyTrack && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h2 className="font-bold mb-2">Spotify Track:</h2>
            <p>{spotifyTrack.name} by {spotifyTrack.artist}</p>
            <p>Album: {spotifyTrack.album}</p>
            {spotifyTrack.artwork && (
              <img 
                src={spotifyTrack.artwork} 
                alt="Spotify album art" 
                className="mt-2 w-32 h-32"
              />
            )}
          </div>
        )}

        {appleTrack && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="font-bold mb-2">Apple Track:</h2>
            <p>{appleTrack.name} by {appleTrack.artist}</p>
            <p>Album: {appleTrack.album}</p>
            {appleTrack.artwork && (
              <img 
                src={appleTrack.artwork} 
                alt="Apple album art" 
                className="mt-2 w-32 h-32"
              />
            )}
          </div>
        )}

        {result && (
          <div className="mt-6 p-4 bg-gray-100 border border-gray-300 rounded-lg">
            <h2 className="font-bold mb-2">Comparison Result:</h2>
            <p className="text-2xl font-bold text-green-600">
              {result.similarity?.toFixed(1)}% Similar
            </p>
            
            {result.distances && (
              <div className="mt-4">
                <h3 className="font-semibold">Hash Distances (lower = more similar):</h3>
                <ul className="mt-2 space-y-1">
                  <li>Average Hash: {result.distances.average}</li>
                  <li>Perceptual Hash: {result.distances.phash}</li>
                  <li>Difference Hash: {result.distances.dhash}</li>
                  <li>Wavelet Hash: {result.distances.whash}</li>
                </ul>
              </div>
            )}

            <div className="mt-4">
              <h3 className="font-semibold">Debug Info:</h3>
              <pre className="mt-2 p-2 bg-white rounded text-xs overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}