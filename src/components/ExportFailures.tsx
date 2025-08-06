"use client";

import { TransferResult } from "@/types/transfer";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import toast from "react-hot-toast";

interface ExportFailuresProps {
  result: TransferResult;
}

export function ExportFailures({ result }: ExportFailuresProps) {
  const exportAsJSON = () => {
    const exportData = {
      playlistName: result.playlistName,
      exportDate: new Date().toISOString(),
      totalTracks: result.totalTracks,
      successfulTransfers: result.successfulTransfers,
      failureCount: result.failures.length,
      failures: result.failures.map(failure => ({
        spotifyTrack: {
          name: failure.spotifyTrack.name,
          artists: failure.spotifyTrack.artists.map(a => a.name).join(", "),
          album: failure.spotifyTrack.album.name,
          duration: Math.floor(failure.spotifyTrack.duration_ms / 1000),
          spotifyId: failure.spotifyTrack.id,
          isrc: failure.spotifyTrack.external_ids?.isrc,
          unavailable: !failure.spotifyTrack.id
        },
        reason: failure.reason,
        details: failure.details,
        possibleMatches: failure.possibleMatches?.map(match => ({
          name: match.name,
          artist: match.artistName,
          album: match.albumName,
          appleMusicId: match.id,
          isrc: match.isrc
        }))
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.playlistName.replace(/[^a-z0-9]/gi, '_')}_failures_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Exported failures as JSON');
  };

  const exportAsCSV = () => {
    // CSV Headers
    const headers = [
      'Spotify Track Name',
      'Artists',
      'Album',
      'Duration (seconds)',
      'ISRC',
      'Spotify ID',
      'Failure Reason',
      'Details',
      'Possible Match 1',
      'Possible Match 1 Artist',
      'Possible Match 1 ID',
      'Possible Match 2',
      'Possible Match 2 Artist',
      'Possible Match 2 ID'
    ];

    // CSV Rows
    const rows = result.failures.map(failure => {
      const match1 = failure.possibleMatches?.[0];
      const match2 = failure.possibleMatches?.[1];
      
      return [
        `"${failure.spotifyTrack.name}"`,
        `"${failure.spotifyTrack.artists.map(a => a.name).join(", ")}"`,
        `"${failure.spotifyTrack.album.name}"`,
        Math.floor(failure.spotifyTrack.duration_ms / 1000),
        failure.spotifyTrack.external_ids?.isrc || '',
        failure.spotifyTrack.id || 'unavailable',
        failure.reason,
        `"${failure.details}"`,
        match1 ? `"${match1.name}"` : '',
        match1 ? `"${match1.artistName}"` : '',
        match1?.id || '',
        match2 ? `"${match2.name}"` : '',
        match2 ? `"${match2.artistName}"` : '',
        match2?.id || ''
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.playlistName.replace(/[^a-z0-9]/gi, '_')}_failures_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Exported failures as CSV');
  };

  const generateReport = () => {
    const unavailableCount = result.failures.filter(f => !f.spotifyTrack.id).length;
    const noMatchesCount = result.failures.filter(f => !f.possibleMatches || f.possibleMatches.length === 0).length;
    const multipleMatchesCount = result.failures.filter(f => f.possibleMatches && f.possibleMatches.length > 0).length;

    const report = `# Music Transfer Report
## ${result.playlistName}
Generated: ${new Date().toLocaleString()}

### Summary
- Total tracks: ${result.totalTracks}
- Successfully matched: ${result.successfulTransfers} (${Math.round((result.successfulTransfers / result.totalTracks) * 100)}%)
- Failed to match: ${result.failures.length} (${Math.round((result.failures.length / result.totalTracks) * 100)}%)

### Failure Breakdown
- Unavailable on Spotify: ${unavailableCount}
- No matches found on Apple Music: ${noMatchesCount}
- Multiple possible matches: ${multipleMatchesCount}

### Failed Tracks
${result.failures.map((failure, idx) => `
${idx + 1}. **${failure.spotifyTrack.name}** by ${failure.spotifyTrack.artists.map(a => a.name).join(", ")}
   - Album: ${failure.spotifyTrack.album.name}
   - Reason: ${failure.reason}
   - ISRC: ${failure.spotifyTrack.external_ids?.isrc || 'Not available'}
   ${failure.possibleMatches && failure.possibleMatches.length > 0 ? 
     `- Possible matches:\n${failure.possibleMatches.slice(0, 3).map((m, i) => 
       `     ${i + 1}. "${m.name}" by ${m.artistName}`
     ).join('\n')}` : ''}
`).join('\n')}

### Recommendations
${unavailableCount > 0 ? `- ${unavailableCount} tracks are unavailable on Spotify but may exist on Apple Music. Try searching manually.` : ''}
${noMatchesCount > 0 ? `- ${noMatchesCount} tracks had no matches. These may be exclusive to Spotify or have different titles on Apple Music.` : ''}
${multipleMatchesCount > 0 ? `- ${multipleMatchesCount} tracks have multiple possible matches. Review these manually to select the correct version.` : ''}
`;

    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.playlistName.replace(/[^a-z0-9]/gi, '_')}_report_${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Generated transfer report');
  };

  if (result.failures.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h3 className="text-lg font-semibold mb-4">Export Failed Matches</h3>
      <p className="text-gray-600 mb-4">
        Download the list of {result.failures.length} unmatched tracks for manual review
      </p>
      
      <div className="flex flex-wrap gap-3">
        <button
          onClick={exportAsJSON}
          className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
        >
          <FileJson className="w-4 h-4" />
          Export as JSON
        </button>
        
        <button
          onClick={exportAsCSV}
          className="flex items-center gap-2 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Export as CSV
        </button>
        
        <button
          onClick={generateReport}
          className="flex items-center gap-2 px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Generate Report
        </button>
      </div>
    </div>
  );
}