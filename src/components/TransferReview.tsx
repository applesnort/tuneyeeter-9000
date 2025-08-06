"use client";

import { useState } from "react";
import { TransferResult, TransferFailure, AppleTrack } from "@/types/transfer";
import { Check, X, Music, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import toast from "react-hot-toast";

interface TransferReviewProps {
  result: TransferResult;
  onComplete: (selectedMatches: Record<string, string>) => void;
}

export function TransferReview({ result, onComplete }: TransferReviewProps) {
  const [selectedMatches, setSelectedMatches] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewMode, setReviewMode] = useState<'all' | 'unmatched'>('unmatched');
  
  const unmatchedTracks = result.failures.filter(f => f.possibleMatches && f.possibleMatches.length > 0);
  const noMatchTracks = result.failures.filter(f => !f.possibleMatches || f.possibleMatches.length === 0);
  
  const tracksToReview = reviewMode === 'all' ? result.failures : unmatchedTracks;
  const currentFailure = tracksToReview[currentIndex];
  
  const selectMatch = (spotifyTrackId: string | undefined, appleTrackId: string) => {
    if (!spotifyTrackId) return;
    
    setSelectedMatches(prev => ({
      ...prev,
      [spotifyTrackId]: appleTrackId
    }));
    
    // Auto-advance to next track
    if (currentIndex < tracksToReview.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };
  
  const skipTrack = () => {
    if (currentIndex < tracksToReview.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };
  
  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };
  
  const handleComplete = () => {
    const matchedCount = Object.keys(selectedMatches).length;
    if (matchedCount === 0) {
      toast.error('Please select at least one match before completing');
      return;
    }
    
    toast.success(`Selected ${matchedCount} matches`);
    onComplete(selectedMatches);
  };
  
  const progress = ((currentIndex + 1) / tracksToReview.length) * 100;
  const matchedCount = Object.keys(selectedMatches).length;
  
  if (!currentFailure) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-4">Review Complete!</h2>
            <p className="text-muted-foreground mb-6">
              You've reviewed all {tracksToReview.length} unmatched tracks and selected {matchedCount} matches.
            </p>
            <Button onClick={handleComplete}>
              Continue to Import
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <h1 className="text-2xl font-bold mb-4">Review Unmatched Tracks</h1>
          
          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-green-500/10 dark:bg-green-500/20 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Successful</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{result.successfulTransfers}</p>
            </div>
            <div className="bg-yellow-500/10 dark:bg-yellow-500/20 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Need Review</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{unmatchedTracks.length}</p>
            </div>
            <div className="bg-red-500/10 dark:bg-red-500/20 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">No Matches</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{noMatchTracks.length}</p>
            </div>
            <div className="bg-blue-500/10 dark:bg-blue-500/20 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Selected</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{matchedCount}</p>
            </div>
          </div>
          
          {/* Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Track {currentIndex + 1} of {tracksToReview.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Current Track Review */}
      <div className="grid grid-cols-2 gap-6">
        {/* Spotify Track */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="w-5 h-5 text-green-500" />
              Spotify Track
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {currentFailure.spotifyTrack.album?.images?.[0] && (
                <img
                  src={currentFailure.spotifyTrack.album.images[0].url}
                  alt="Album cover"
                  className="w-32 h-32 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <h4 className="font-semibold text-lg">{currentFailure.spotifyTrack.name}</h4>
                <p className="text-muted-foreground">
                  {currentFailure.spotifyTrack.artists.map(a => a.name).join(", ")}
                </p>
                <p className="text-sm text-muted-foreground">{currentFailure.spotifyTrack.album.name}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Duration: {Math.floor(currentFailure.spotifyTrack.duration_ms / 1000)}s
                </p>
                {!currentFailure.spotifyTrack.id && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2 flex items-center gap-1">
                    <AlertCircle size={14} />
                    Unavailable on Spotify
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Apple Music Matches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="w-5 h-5" />
              Apple Music Matches
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentFailure.possibleMatches && currentFailure.possibleMatches.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {currentFailure.possibleMatches.map((match: AppleTrack, idx: number) => {
                  const spotifyId = currentFailure.spotifyTrack.id || 
                                 (currentFailure.spotifyTrack.uri ? currentFailure.spotifyTrack.uri.split(':')[2] : null);
                  const isSelected = spotifyId && selectedMatches[spotifyId] === match.id;
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => selectMatch(spotifyId || undefined, match.id)}
                      className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                        isSelected 
                          ? 'border-green-500 bg-green-500/10 dark:bg-green-500/20' 
                          : 'border-border hover:border-muted-foreground/50 hover:bg-accent'
                      }`}
                    >
                      <div className="flex gap-3">
                        {match.artworkUrl && (
                          <img
                            src={match.artworkUrl}
                            alt="Album cover"
                            className="w-16 h-16 rounded object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{match.name}</p>
                          <p className="text-sm text-muted-foreground">{match.artistName}</p>
                          <p className="text-xs text-muted-foreground">{match.albumName}</p>
                          <p className="text-xs text-muted-foreground">
                            Duration: {Math.floor(Number(match.durationMillis) / 1000)}s
                          </p>
                        </div>
                        {isSelected && (
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0 self-center" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <X className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No matches found on Apple Music</p>
                <p className="text-sm text-muted-foreground mt-2">
                  This track will need to be added manually
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <div className="flex gap-2">
          <Button
            onClick={goToPrevious}
            disabled={currentIndex === 0}
            variant="outline"
          >
            Previous
          </Button>
          <Button
            onClick={() => setCurrentIndex(currentIndex + 1)}
            disabled={currentIndex === tracksToReview.length - 1}
            variant="outline"
          >
            Next
          </Button>
        </div>
        
        <div className="flex gap-4">
          <Button
            onClick={skipTrack}
            variant="outline"
          >
            Skip This Track
          </Button>
          
          {currentIndex === tracksToReview.length - 1 && (
            <Button
              onClick={handleComplete}
              disabled={matchedCount === 0}
            >
              Complete Review ({matchedCount} selected)
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}