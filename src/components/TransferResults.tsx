"use client";

import { useState } from "react";
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Download, 
  Music,
  ChevronDown,
  ChevronUp,
  ExternalLink
} from "lucide-react";
import { TransferResult, TransferFailure } from "@/types/transfer";

interface TransferResultsProps {
  results: TransferResult;
  onStartNew: () => void;
}

export function TransferResults({ results, onStartNew }: TransferResultsProps) {
  const [expandedFailures, setExpandedFailures] = useState<Set<number>>(new Set());
  const successRate = Math.round((results.successfulTransfers / results.totalTracks) * 100);

  const toggleFailure = (index: number) => {
    const newExpanded = new Set(expandedFailures);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedFailures(newExpanded);
  };

  const downloadReport = (format: 'json' | 'plif' = 'json') => {
    if (format === 'plif') {
      // Export in PLIF format for compatibility with Playlisty
      const plifData = {
        playlists: [{
          caption: results.playlistName,
          description: `Transferred from Spotify on ${results.transferDate}`,
          curator: "Music Transfer Tool",
          rows: results.failures.map(f => ({
            name: f.spotifyTrack.name,
            artist: f.spotifyTrack.artists.map(a => a.name).join(", "),
            album: f.spotifyTrack.album.name,
            identifiers: {
              isrc: f.spotifyTrack.external_ids?.isrc || "",
              spotify_id: f.spotifyTrack.id,
              duration_ms: f.spotifyTrack.duration_ms,
              failure_reason: f.reason,
              suggested_action: f.suggestedAction
            }
          }))
        }]
      };
      
      const blob = new Blob([JSON.stringify(plifData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `failed-tracks-${results.playlistName}-${new Date().toISOString().split("T")[0]}.plif`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      const report = {
        ...results,
        failureDetails: results.failures.map(f => ({
          track: `${f.spotifyTrack.name} - ${f.spotifyTrack.artists.map(a => a.name).join(", ")}`,
          album: f.spotifyTrack.album.name,
          reason: f.reason,
          details: f.details,
          suggestedAction: f.suggestedAction,
          spotifyUri: f.spotifyTrack.uri
        }))
      };

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transfer-report-${results.playlistName}-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const getReasonIcon = (reason: TransferFailure["reason"]) => {
    switch (reason) {
      case "not_found":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "region_locked":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "multiple_matches":
        return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      default:
        return <XCircle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getReasonLabel = (reason: TransferFailure["reason"]) => {
    switch (reason) {
      case "not_found":
        return "Not Found";
      case "region_locked":
        return "Region Locked";
      case "multiple_matches":
        return "Multiple Matches";
      case "api_error":
        return "API Error";
      default:
        return "Unknown";
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Transfer Complete!</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Successful</span>
            </div>
            <p className="text-2xl font-bold text-green-900 mt-1">
              {results.successfulTransfers}
            </p>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 text-red-700">
              <XCircle className="w-5 h-5" />
              <span className="font-semibold">Failed</span>
            </div>
            <p className="text-2xl font-bold text-red-900 mt-1">
              {results.failures.length}
            </p>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 text-blue-700">
              <Music className="w-5 h-5" />
              <span className="font-semibold">Success Rate</span>
            </div>
            <p className="text-2xl font-bold text-blue-900 mt-1">
              {successRate}%
            </p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => downloadReport('json')}
            className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Report (JSON)
          </button>
          {results.failures.length > 0 && (
            <button
              onClick={() => downloadReport('plif')}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Failed Tracks (PLIF)
            </button>
          )}
          <button
            onClick={onStartNew}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            Transfer Another Playlist
          </button>
        </div>
      </div>

      {results.failures.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-4">Failed Transfers</h3>
          <div className="space-y-3">
            {results.failures.map((failure, index) => (
              <div key={index} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleFailure(index)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    {getReasonIcon(failure.reason)}
                    <div className="text-left">
                      <p className="font-medium text-gray-900">
                        {failure.spotifyTrack.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {failure.spotifyTrack.artists.map(a => a.name).join(", ")} • {failure.spotifyTrack.album.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-600 bg-gray-200 px-2 py-1 rounded">
                      {getReasonLabel(failure.reason)}
                    </span>
                    {expandedFailures.has(index) ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                </button>
                
                {expandedFailures.has(index) && (
                  <div className="px-4 py-3 bg-white border-t">
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Details:</p>
                        <p className="text-sm text-gray-600">{failure.details}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium text-gray-700">Suggested Action:</p>
                        <p className="text-sm text-gray-600">{failure.suggestedAction}</p>
                      </div>
                      
                      {failure.possibleMatches && failure.possibleMatches.length > 0 && (
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-1">Possible Matches:</p>
                          <ul className="space-y-1">
                            {failure.possibleMatches.map((match, i) => (
                              <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                                <span>• {match.name} - {match.artistName}</span>
                                <a
                                  href={match.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-700"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <div className="pt-2">
                        <a
                          href={failure.spotifyTrack.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-green-600 hover:text-green-700 inline-flex items-center gap-1"
                        >
                          Open in Spotify
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}