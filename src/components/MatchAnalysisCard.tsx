import React from 'react';

interface MatchAnalysisCardProps {
  score: {
    totalScore: number;
    confidence: string;
    breakdown: {
      titleSimilarity: number;
      artistSimilarity: number;
      albumSimilarity: number;
      durationSimilarity: number;
      releaseDateSimilarity: number;
      isCompilation?: boolean;
      isRemixMatch?: boolean;
    };
  };
  spotifyTrack: {
    name: string;
    artists: { name: string }[];
    album: { name: string; release_date?: string };
    duration_ms: number;
  };
  appleTrack: {
    name: string;
    artistName: string;
    albumName: string;
    durationMillis: number | string;
    releaseDate?: string;
  };
}

export function MatchAnalysisCard({ score, spotifyTrack, appleTrack }: MatchAnalysisCardProps) {
  const getScoreColor = (value: number) => {
    if (value >= 0.9) return 'text-green-600';
    if (value >= 0.7) return 'text-green-500';
    if (value >= 0.5) return 'text-yellow-600';
    if (value >= 0.3) return 'text-orange-600';
    return 'text-red-600';
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence.toLowerCase()) {
      case 'high': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-orange-600';
      default: return 'text-red-600';
    }
  };

  const formatDuration = (ms: number | string) => {
    const msNum = typeof ms === 'string' ? parseInt(ms) : ms;
    const seconds = Math.floor(msNum / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Determine which fields match
  const fieldMatches = {
    title: score.breakdown.titleSimilarity === 1,
    artist: score.breakdown.artistSimilarity === 1,
    album: score.breakdown.albumSimilarity >= 0.9,
    duration: score.breakdown.durationSimilarity >= 0.95,
    releaseDate: score.breakdown.releaseDateSimilarity >= 0.9,
  };

  const FieldComparison = ({ 
    label, 
    spotify, 
    apple, 
    matches 
  }: { 
    label: string; 
    spotify: string; 
    apple: string; 
    matches: boolean;
  }) => (
    <div className={`flex items-center gap-2 py-1.5 ${!matches ? 'bg-orange-50' : ''}`}>
      <span className="text-sm text-gray-600 w-20 flex-shrink-0">{label}:</span>
      <div className="flex-1 flex items-center text-sm">
        <div className="flex-1 text-right pr-3 break-words">{spotify}</div>
        <div className="flex-shrink-0 w-8 text-center">
          {matches ? (
            <span className="text-green-600 font-medium">✓</span>
          ) : (
            <span className="text-orange-600">≠</span>
          )}
        </div>
        <div className={`flex-1 text-left pl-3 break-words ${matches ? '' : 'text-orange-600'}`}>
          {apple}
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-blue-50 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-blue-100 px-4 py-3 border-b border-blue-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Match Analysis</h3>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-600">Overall Score: </span>
              <span className={`font-semibold ${getScoreColor(score.totalScore)}`}>
                {(score.totalScore * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-gray-600">Confidence: </span>
              <span className={`font-semibold ${getConfidenceColor(score.confidence)}`}>
                {score.confidence.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 grid grid-cols-3 gap-4">
        {/* Left Column - Scores */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Match Scores</h4>
          
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Title</span>
              <span className={`text-sm font-medium ${getScoreColor(score.breakdown.titleSimilarity)}`}>
                {(score.breakdown.titleSimilarity * 100).toFixed(0)}%
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Artist</span>
              <span className={`text-sm font-medium ${getScoreColor(score.breakdown.artistSimilarity)}`}>
                {(score.breakdown.artistSimilarity * 100).toFixed(0)}%
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Album</span>
              <span className={`text-sm font-medium ${getScoreColor(score.breakdown.albumSimilarity)}`}>
                {(score.breakdown.albumSimilarity * 100).toFixed(0)}%
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Duration</span>
              <span className={`text-sm font-medium ${getScoreColor(score.breakdown.durationSimilarity)}`}>
                {(score.breakdown.durationSimilarity * 100).toFixed(0)}%
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Release Date</span>
              <span className={`text-sm font-medium ${getScoreColor(score.breakdown.releaseDateSimilarity)}`}>
                {(score.breakdown.releaseDateSimilarity * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Warnings */}
          <div className="mt-3 space-y-1">
            {score.breakdown.isCompilation && (
              <div className="text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                ⚠️ Compilation album
              </div>
            )}
            {score.breakdown.isRemixMatch === false && (
              <div className="text-xs text-orange-700 bg-orange-100 px-2 py-1 rounded">
                ⚠️ Version mismatch
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Field Comparison */}
        <div className="col-span-2">
          <div className="bg-white rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-sm font-medium text-gray-700 w-20">Fields</h4>
              <div className="flex-1 flex items-center text-xs text-gray-500 font-medium">
                <div className="flex-1 text-right pr-3">Spotify</div>
                <div className="w-8"></div>
                <div className="flex-1 text-left pl-3">Apple Music</div>
              </div>
            </div>
            
            <div className="space-y-0.5">
              {/* Matching fields first */}
              {fieldMatches.title && (
                <FieldComparison
                  label="Title"
                  spotify={spotifyTrack.name}
                  apple={appleTrack.name}
                  matches={true}
                />
              )}
              
              {fieldMatches.artist && (
                <FieldComparison
                  label="Artist"
                  spotify={spotifyTrack.artists.map(a => a.name).join(', ')}
                  apple={appleTrack.artistName}
                  matches={true}
                />
              )}
              
              {fieldMatches.album && (
                <FieldComparison
                  label="Album"
                  spotify={spotifyTrack.album.name}
                  apple={appleTrack.albumName}
                  matches={true}
                />
              )}
              
              {fieldMatches.duration && (
                <FieldComparison
                  label="Duration"
                  spotify={formatDuration(spotifyTrack.duration_ms)}
                  apple={formatDuration(appleTrack.durationMillis)}
                  matches={true}
                />
              )}
              
              {fieldMatches.releaseDate && spotifyTrack.album.release_date && appleTrack.releaseDate && (
                <FieldComparison
                  label="Release"
                  spotify={spotifyTrack.album.release_date}
                  apple={appleTrack.releaseDate.split('T')[0]}
                  matches={true}
                />
              )}
              
              {/* Separator if there are mismatches */}
              {Object.values(fieldMatches).some(v => !v) && (
                <div className="border-t border-gray-200 my-2"></div>
              )}
              
              {/* Mismatched fields */}
              {!fieldMatches.title && (
                <FieldComparison
                  label="Title"
                  spotify={spotifyTrack.name}
                  apple={appleTrack.name}
                  matches={false}
                />
              )}
              
              {!fieldMatches.artist && (
                <FieldComparison
                  label="Artist"
                  spotify={spotifyTrack.artists.map(a => a.name).join(', ')}
                  apple={appleTrack.artistName}
                  matches={false}
                />
              )}
              
              {!fieldMatches.album && (
                <FieldComparison
                  label="Album"
                  spotify={spotifyTrack.album.name}
                  apple={appleTrack.albumName}
                  matches={false}
                />
              )}
              
              {!fieldMatches.duration && (
                <FieldComparison
                  label="Duration"
                  spotify={formatDuration(spotifyTrack.duration_ms)}
                  apple={formatDuration(appleTrack.durationMillis)}
                  matches={false}
                />
              )}
              
              {!fieldMatches.releaseDate && spotifyTrack.album.release_date && appleTrack.releaseDate && (
                <FieldComparison
                  label="Release"
                  spotify={spotifyTrack.album.release_date}
                  apple={appleTrack.releaseDate.split('T')[0]}
                  matches={false}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}