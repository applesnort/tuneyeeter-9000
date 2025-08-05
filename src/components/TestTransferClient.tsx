"use client";

import { useState } from "react";
import { CustomSession } from "@/lib/auth-utils";
import { TrackComparisonDiffV2 } from "./TrackComparisonDiffV2";

interface TestTransferClientProps {
  session: CustomSession | null;
}

export function TestTransferClient({ session }: TestTransferClientProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [useV2Algorithm, setUseV2Algorithm] = useState(true);

  if (!session) {
    return (
      <div className="min-h-screen p-8 bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Not Authenticated</h1>
          <p className="text-gray-600 mb-6">Please sign in to test the transfer functionality.</p>
          <a href="/api/auth/signin" className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  const testTransfer = async () => {
    setLoading(true);
    setLogs([]);
    setResult(null);
    
    try {
      // Use the same playlist that was failing
      const playlistUrl = "https://open.spotify.com/playlist/6lf0FyFnEoN7THbDebLJ8R";
      const playlistId = playlistUrl.split("/playlist/")[1].split("?")[0];
      
      setLogs(prev => [...prev, "Starting transfer..."]);
      setLogs(prev => [...prev, `Using access token: ${session.accessToken.substring(0, 10)}...`]);
      
      const endpoint = useV2Algorithm ? "/api/transfer-v2" : "/api/transfer";
      setLogs(prev => [...prev, `Using ${useV2Algorithm ? 'V2 (research-based)' : 'V1 (simple)'} algorithm`]);
      
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({ playlistId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Transfer failed");
      }

      const data = await response.json();
      setResult(data);
      setLogs(prev => [...prev, `Transfer complete: ${data.successfulTransfers}/${data.totalTracks} successful`]);
      
    } catch (error) {
      console.error("Error:", error);
      setLogs(prev => [...prev, `Error: ${error instanceof Error ? error.message : "Unknown error"}`]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Transfer Test - Debug Mode</h1>
        
        <div className="mb-8">
          <p className="text-gray-600 mb-4">
            This will test the transfer with playlist ID: 6lf0FyFnEoN7THbDebLJ8R
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Session active (expires: {session.expiresAt ? new Date(session.expiresAt).toLocaleString() : 'unknown'})
          </p>
          
          {/* Algorithm Toggle */}
          <div className="mb-4 flex items-center gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="algorithm"
                checked={useV2Algorithm}
                onChange={() => setUseV2Algorithm(true)}
                className="mr-2"
              />
              <span className="font-medium">V2 Algorithm (Research-based)</span>
              <span className="text-sm text-gray-500 ml-2">Weighted scoring, fuzzy matching</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="algorithm"
                checked={!useV2Algorithm}
                onChange={() => setUseV2Algorithm(false)}
                className="mr-2"
              />
              <span className="font-medium">V1 Algorithm (Simple)</span>
              <span className="text-sm text-gray-500 ml-2">Basic exact matching</span>
            </label>
          </div>
          
          <button
            onClick={testTransfer}
            disabled={loading}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "Testing Transfer..." : "Start Test Transfer"}
          </button>
        </div>

        {logs.length > 0 && (
          <div className="mb-8 p-4 bg-gray-100 rounded-lg">
            <h2 className="font-semibold mb-2">Logs:</h2>
            <div className="space-y-1">
              {logs.map((log, idx) => (
                <p key={idx} className="text-sm font-mono">{log}</p>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Transfer Summary</h2>
              <p className="text-lg">Playlist: <span className="font-semibold">{result.playlistName}</span></p>
              <p className="text-lg">Total Tracks: <span className="font-semibold">{result.totalTracks}</span></p>
              <p className="text-lg">Successful: <span className="font-semibold text-green-600">{result.successfulTransfers}</span></p>
              <p className="text-lg">Failed: <span className="font-semibold text-red-600">{result.failures.length}</span></p>
            </div>

            {/* Track Comparison Diff */}
            {result.successful && result.successful.length > 0 && (
              <TrackComparisonDiffV2 transfers={result.successful} />
            )}

            {result.failures.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Failed Tracks</h2>
                <div className="space-y-6">
                  {result.failures.map((failure: any, idx: number) => (
                    <div key={idx} className="border-b pb-4 last:border-b-0">
                      <div className="grid grid-cols-2 gap-6">
                        {/* Spotify Track */}
                        <div>
                          <h3 className="font-semibold text-lg text-green-600 mb-2">Spotify</h3>
                          {failure.spotifyTrack.album.images?.[0] && (
                            <div className="mb-3">
                              <img
                                src={failure.spotifyTrack.album.images[0].url}
                                alt={`${failure.spotifyTrack.album.name} cover`}
                                className="w-32 aspect-square object-cover rounded-lg shadow-md"
                              />
                            </div>
                          )}
                          <p className="font-medium">{failure.spotifyTrack.name}</p>
                          <p className="text-sm text-gray-600">Artist: {failure.spotifyTrack.artists.map((a: any) => a.name).join(", ")}</p>
                          <p className="text-sm text-gray-600">Album: {failure.spotifyTrack.album.name}</p>
                          <p className="text-sm text-gray-600">Duration: {Math.floor(failure.spotifyTrack.duration_ms / 1000)}s</p>
                          <p className="text-sm text-red-600 mt-2">Reason: {failure.reason}</p>
                        </div>

                        {/* Apple Music Matches */}
                        <div>
                          <h3 className="font-semibold text-lg text-gray-800 mb-2">Possible Apple Music Matches</h3>
                          {failure.possibleMatches && failure.possibleMatches.length > 0 ? (
                            <div className="space-y-3">
                              {failure.possibleMatches.slice(0, 5).map((match: any, midx: number) => (
                                <div key={midx} className="bg-gray-50 p-3 rounded-lg flex gap-3">
                                  {match.artworkUrl && (
                                    <img
                                      src={match.artworkUrl}
                                      alt={`${match.albumName} cover`}
                                      className="w-16 aspect-square object-cover rounded-md flex-shrink-0"
                                    />
                                  )}
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{match.name}</p>
                                    <p className="text-xs text-gray-600">Artist: {match.artistName}</p>
                                    <p className="text-xs text-gray-600">Album: {match.albumName}</p>
                                    <p className="text-xs text-gray-600">
                                      Duration: {Math.floor(parseInt(match.durationMillis || 0) / 1000)}s
                                      {Math.abs(parseInt(match.durationMillis || 0) - failure.spotifyTrack.duration_ms) < 5000 && 
                                        <span className="text-green-600 ml-1">✓</span>
                                      }
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500">No matches found</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Full Response</h2>
              <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}