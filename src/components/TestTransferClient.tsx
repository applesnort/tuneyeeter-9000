"use client";

import { useState } from "react";
import { CustomSession } from "@/lib/auth-utils";
import { TrackComparisonDiffV2 } from "./TrackComparisonDiffV2";
import { Copy } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

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
      // Use the new test playlist
      const playlistUrl = "https://open.spotify.com/playlist/6ZqKAo7ECLlFSwOX278S8V";
      const playlistId = playlistUrl.split("/playlist/")[1].split("?")[0];
      
      setLogs(prev => [...prev, "Starting transfer..."]);
      setLogs(prev => [...prev, `Using access token: ${session.accessToken.substring(0, 10)}...`]);
      
      const endpoint = useV2Algorithm ? "/api/transfer-v3" : "/api/transfer";
      setLogs(prev => [...prev, `Using ${useV2Algorithm ? 'V3 (MusicKit + research-based)' : 'V1 (simple)'} algorithm`]);
      
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
            This will test the transfer with playlist ID: 6ZqKAo7ECLlFSwOX278S8V
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
              <span className="font-medium">V3 Algorithm (MusicKit + Research-based)</span>
              <span className="text-sm text-gray-500 ml-2">MusicKit API, ISRC matching, fuzzy matching with filters</span>
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
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold">Transfer Summary</h2>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
                    toast.success('Results copied to clipboard!');
                  }}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded border flex items-center gap-1"
                >
                  <Copy size={14} /> Copy JSON
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-lg">Playlist: <span className="font-semibold">{result.playlistName}</span></p>
                  <p className="text-lg">Total Tracks: <span className="font-semibold">{result.totalTracks}</span></p>
                  <p className="text-lg">Successful: <span className="font-semibold text-green-600">{result.successfulTransfers}</span></p>
                  <p className="text-lg">Failed: <span className="font-semibold text-red-600">{result.failures.length}</span></p>
                </div>
                
                {result.timing && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Performance Metrics</h3>
                    <p className="text-sm">Total Time: <span className="font-mono">{Math.round(result.timing.overallTime / 1000)}s</span></p>
                    <p className="text-sm">API Calls: <span className="font-mono">{result.timing.totalApiCalls}</span></p>
                    <p className="text-sm">Avg Time/Track: <span className="font-mono">{Math.round(result.timing.averageTimePerTrack / 1000)}s</span></p>
                    <p className="text-sm">Avg API Calls/Track: <span className="font-mono">{result.timing.averageApiCallsPerTrack}</span></p>
                  </div>
                )}
              </div>
            </div>

            {/* Track Comparison Diff */}
            {result.successful && result.successful.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Successful Tracks ({result.successful.length})</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 font-semibold">Track</th>
                        <th className="text-left py-2 font-semibold">Artist</th>
                        <th className="text-left py-2 font-semibold">Album</th>
                        <th className="text-left py-2 font-semibold">Duration</th>
                        <th className="text-left py-2 font-semibold">Spotify ID</th>
                        <th className="text-left py-2 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.successful.map((transfer: any, idx: number) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              {transfer.spotifyTrack.album.images?.[0] && (
                                <img
                                  src={transfer.spotifyTrack.album.images[0].url}
                                  alt="cover"
                                  className="w-10 h-10 object-cover rounded"
                                />
                              )}
                              <span className="font-medium">{transfer.spotifyTrack.name}</span>
                            </div>
                          </td>
                          <td className="py-3 text-gray-600">
                            {transfer.spotifyTrack.artists.map((a: any) => a.name).join(", ")}
                          </td>
                          <td className="py-3 text-gray-600">{transfer.spotifyTrack.album.name}</td>
                          <td className="py-3 text-gray-600 font-mono">
                            {Math.floor(transfer.spotifyTrack.duration_ms / 1000)}s
                          </td>
                          <td className="py-3">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {(() => {
                                const directId = transfer.spotifyTrack.id;
                                const uriId = transfer.spotifyTrack.uri ? transfer.spotifyTrack.uri.split(':')[2] : null;
                                return directId || uriId || 'No ID';
                              })()}
                            </code>
                          </td>
                          <td className="py-3">
                            <button
                              onClick={() => {
                                const trackId = transfer.spotifyTrack.id || 
                                               (transfer.spotifyTrack.uri ? transfer.spotifyTrack.uri.split(':')[2] : null);
                                if (trackId) {
                                  navigator.clipboard.writeText(trackId);
                                  toast.success('Track ID copied!');
                                } else {
                                  toast.error('No track ID available');
                                }
                              }}
                              className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded flex items-center gap-1"
                            >
                              <Copy size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {result.failures.length > 0 && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">Failed Tracks ({result.failures.length})</h2>
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
                          {failure.unavailableConfidence && (
                            <div className="mt-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Unavailability Confidence:</span>
                                <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[200px]">
                                  <div 
                                    className={`h-2 rounded-full ${
                                      failure.unavailableConfidence >= 80 ? 'bg-red-500' :
                                      failure.unavailableConfidence >= 60 ? 'bg-orange-500' :
                                      'bg-yellow-500'
                                    }`}
                                    style={{ width: `${failure.unavailableConfidence}%` }}
                                  />
                                </div>
                                <span className="text-sm font-mono">{failure.unavailableConfidence}%</span>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">{failure.details}</p>
                            </div>
                          )}
                          <div className="mt-2">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {(() => {
                                const directId = failure.spotifyTrack.id;
                                const uriId = failure.spotifyTrack.uri ? failure.spotifyTrack.uri.split(':')[2] : null;
                                console.log(`Track "${failure.spotifyTrack.name}" - Direct ID: "${directId}", URI: "${failure.spotifyTrack.uri}", URI ID: "${uriId}"`);
                                return directId || uriId || 'Unavailable on Spotify';
                              })()}
                            </code>
                            <button
                              onClick={() => {
                                const trackId = failure.spotifyTrack.id || 
                                               (failure.spotifyTrack.uri ? failure.spotifyTrack.uri.split(':')[2] : null);
                                if (trackId) {
                                  navigator.clipboard.writeText(trackId);
                                  toast.success('Track ID copied!');
                                } else {
                                  toast.error('No track ID available');
                                }
                              }}
                              className="ml-2 text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded flex items-center gap-1"
                            >
                              <Copy size={12} />
                            </button>
                            <button
                              onClick={async () => {
                                console.log('Debug track object:', failure.spotifyTrack);
                                console.log('Track ID:', failure.spotifyTrack.id);
                                console.log('Track URI:', failure.spotifyTrack.uri);
                                
                                // For unavailable tracks, we can still test with the metadata
                                if (!failure.spotifyTrack.id && !failure.spotifyTrack.uri) {
                                  // Test with metadata only
                                  try {
                                    const response = await fetch('/api/test-single-track', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ 
                                        trackMetadata: {
                                          name: failure.spotifyTrack.name,
                                          artists: failure.spotifyTrack.artists,
                                          album: failure.spotifyTrack.album,
                                          duration_ms: failure.spotifyTrack.duration_ms
                                        }
                                      })
                                    });
                                    if (!response.ok) {
                                      const errorData = await response.json();
                                      console.error('Test failed:', errorData);
                                      toast.error(`Test failed: ${errorData.error || 'Unknown error'}`);
                                      return;
                                    }
                                    const result = await response.json();
                                    console.log('Single track test result (metadata only):', result);
                                    toast.success('Test completed - check console for detailed results');
                                  } catch (error) {
                                    console.error('Test failed:', error);
                                    toast.error('Test failed - check console for details');
                                  }
                                  return;
                                }
                                
                                // Extract ID from URI if needed
                                const trackId = failure.spotifyTrack.id || 
                                              (failure.spotifyTrack.uri ? failure.spotifyTrack.uri.split(':')[2] : null);
                                
                                try {
                                  const response = await fetch('/api/test-single-track', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ trackId })
                                  });
                                  if (!response.ok) {
                                    const errorData = await response.json();
                                    console.error('Test failed:', errorData);
                                    toast.error(`Test failed: ${errorData.error || 'Unknown error'}`);
                                    return;
                                  }
                                  const result = await response.json();
                                  console.log('Single track test result:', result);
                                  toast.success('Test completed - check console for detailed results');
                                } catch (error) {
                                  console.error('Test failed:', error);
                                  toast.error('Test failed - check console for details');
                                }
                              }}
                              className="ml-2 text-xs px-2 py-1 bg-green-100 hover:bg-green-200 rounded"
                              title={!failure.spotifyTrack.id ? "Track unavailable on Spotify - will test with metadata" : "Test this single track"}
                            >
                              Test Single
                            </button>
                          </div>
                        </div>

                        {/* Apple Music Matches */}
                        <div>
                          <h3 className="font-semibold text-lg text-gray-800 mb-2">
                            {failure.closestMatches && failure.closestMatches.length > 0 
                              ? "Closest Apple Music Matches" 
                              : "Possible Apple Music Matches"}
                          </h3>
                          
                          {/* Show closest matches with similarity scores if available */}
                          {failure.closestMatches && failure.closestMatches.length > 0 ? (
                            <div className="space-y-3">
                              {failure.closestMatches.map((match: any, midx: number) => (
                                <div key={midx} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                  <div className="flex gap-3">
                                    {match.track.artworkUrl && (
                                      <img
                                        src={match.track.artworkUrl}
                                        alt={`${match.track.albumName} cover`}
                                        className="w-16 aspect-square object-cover rounded-md flex-shrink-0"
                                      />
                                    )}
                                    <div className="flex-1">
                                      <div className="flex items-start justify-between">
                                        <div>
                                          <p className="font-medium text-sm">{match.track.name}</p>
                                          <p className="text-xs text-gray-600">Artist: {match.track.artistName}</p>
                                          <p className="text-xs text-gray-600">Album: {match.track.albumName}</p>
                                          <p className="text-xs text-gray-600">
                                            Duration: {Math.floor(parseInt(match.track.durationMillis || 0) / 1000)}s
                                          </p>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-sm font-medium text-green-600">{match.similarity}% match</div>
                                          <button className="mt-1 text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 rounded">
                                            Select as replacement
                                          </button>
                                        </div>
                                      </div>
                                      {match.differences && match.differences.length > 0 && (
                                        <div className="mt-2 text-xs text-orange-600">
                                          Differences: {match.differences.join(', ')}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : failure.possibleMatches && failure.possibleMatches.length > 0 ? (
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
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            style: {
              background: '#10b981',
            },
          },
          error: {
            style: {
              background: '#ef4444',
            },
          },
        }}
      />
    </div>
  );
}