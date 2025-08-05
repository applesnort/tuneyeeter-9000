"use client";

import { useState } from "react";

export default function TestSimple() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testArtwork = async () => {
    setLoading(true);
    
    try {
      // Test with known URLs that work
      const spotifyUrl = "https://i.scdn.co/image/ab67616d0000b273add9e99254d302a348def6e2"; // Kaskade - Strobelite Seduction
      const appleUrl = "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/28/5e/4f/285e4f3f-ed66-fe33-6ff2-f64af59debf4/617465171550.jpg/600x600bb.jpg"; // Kaskade - Strobelite Seduction (correct album)
      
      const response = await fetch("/api/compare-artwork", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url1: spotifyUrl,
          url2: appleUrl,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Comparison failed");
      }

      const data = await response.json();
      setResult(data);
      
    } catch (error) {
      console.error("Error:", error);
      setResult({ error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-8">Simple Artwork Test</h1>
      
      <button
        onClick={testArtwork}
        disabled={loading}
        className="bg-blue-500 text-white px-6 py-3 rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? "Testing..." : "Test Artwork Comparison"}
      </button>

      {result && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Result:</h2>
          {result.error ? (
            <p className="text-red-600">Error: {result.error}</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-green-600 mb-4">
                {result.similarity?.toFixed(1)}% Similar
              </p>
              
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg shadow">
                  <h3 className="font-semibold mb-2">Hash Distances (0 = identical)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Average Hash:</p>
                      <p className="font-mono">{result.distances?.average || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Perceptual Hash:</p>
                      <p className="font-mono">{result.distances?.phash || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Difference Hash:</p>
                      <p className="font-mono">{result.distances?.dhash || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Wavelet Hash:</p>
                      <p className="font-mono">{result.distances?.whash || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow">
                  <h3 className="font-semibold mb-2">Algorithm Breakdown</h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-gray-600">Average Hash Similarity:</p>
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-200 rounded-full w-48 h-4">
                          <div 
                            className="bg-blue-500 h-full rounded-full"
                            style={{ width: `${result.avg_similarity || 0}%` }}
                          />
                        </div>
                        <span className="font-mono text-sm">{result.avg_similarity?.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Perceptual Hash Similarity:</p>
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-200 rounded-full w-48 h-4">
                          <div 
                            className="bg-green-500 h-full rounded-full"
                            style={{ width: `${result.phash_similarity || 0}%` }}
                          />
                        </div>
                        <span className="font-mono text-sm">{result.phash_similarity?.toFixed(1)}%</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Overall = (Average × 0.6) + (Perceptual × 0.4) = {result.similarity?.toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow">
                  <h3 className="font-semibold mb-2">Hash Values</h3>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm text-gray-600">Image 1 Hashes:</p>
                      <div className="font-mono text-xs bg-gray-100 p-2 rounded">
                        <p>AVG: {result.hashes1?.average}</p>
                        <p>PH: {result.hashes1?.phash}</p>
                        <p>DH: {result.hashes1?.dhash}</p>
                        <p>WH: {result.hashes1?.whash}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Image 2 Hashes:</p>
                      <div className="font-mono text-xs bg-gray-100 p-2 rounded">
                        <p>AVG: {result.hashes2?.average}</p>
                        <p>PH: {result.hashes2?.phash}</p>
                        <p>DH: {result.hashes2?.dhash}</p>
                        <p>WH: {result.hashes2?.whash}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow">
                  <h3 className="font-semibold mb-2">Raw JSON Response</h3>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div>
          <h3 className="font-semibold mb-2">Spotify (Kaskade - Strobelite Seduction)</h3>
          <img 
            src="https://i.scdn.co/image/ab67616d0000b273add9e99254d302a348def6e2" 
            alt="Spotify" 
            className="w-64 h-64"
          />
        </div>
        <div>
          <h3 className="font-semibold mb-2">Apple Music (Kaskade - Strobelite Seduction)</h3>
          <img 
            src="https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/28/5e/4f/285e4f3f-ed66-fe33-6ff2-f64af59debf4/617465171550.jpg/600x600bb.jpg" 
            alt="Apple" 
            className="w-64 h-64"
          />
        </div>
      </div>
    </div>
  );
}