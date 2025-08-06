"use client";

import { useEffect, useState } from "react";
import { Progress } from "@radix-ui/react-progress";
import { Loader2, CheckCircle, XCircle, Music } from "lucide-react";

interface TransferProgressProps {
  transferId: string;
  totalTracks: number;
  playlistName: string;
}

interface ProgressData {
  currentTrack: number;
  currentTrackName: string;
  successCount: number;
  failureCount: number;
  status: 'searching' | 'matching' | 'complete' | 'error';
  estimatedTimeRemaining?: number;
}

export function TransferProgress({ transferId, totalTracks, playlistName }: TransferProgressProps) {
  const [progress, setProgress] = useState<ProgressData>({
    currentTrack: 0,
    currentTrackName: '',
    successCount: 0,
    failureCount: 0,
    status: 'searching'
  });

  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/transfer-progress?transferId=${transferId}`);
        if (response.ok) {
          const data = await response.json();
          setProgress(data);
          
          if (data.status === 'complete' || data.status === 'error') {
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        console.error('Failed to fetch progress:', error);
      }
    }, 1000); // Poll every second

    return () => clearInterval(pollInterval);
  }, [transferId]);

  const percentage = (progress.currentTrack / totalTracks) * 100;
  const successRate = progress.currentTrack > 0 
    ? Math.round((progress.successCount / progress.currentTrack) * 100) 
    : 0;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Transferring "{playlistName}"</h2>
        <p className="text-gray-600">
          Processing {progress.currentTrack} of {totalTracks} tracks
        </p>
      </div>

      {/* Main Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Overall Progress</span>
          <span>{Math.round(percentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div 
            className="bg-blue-500 h-full transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Current Track */}
      {progress.currentTrackName && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            <div className="flex-1">
              <p className="text-sm text-gray-600">Currently searching for:</p>
              <p className="font-medium truncate">{progress.currentTrackName}</p>
            </div>
          </div>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-green-600">{progress.successCount}</p>
          <p className="text-sm text-gray-600">Matched</p>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <XCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-red-600">{progress.failureCount}</p>
          <p className="text-sm text-gray-600">Unmatched</p>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <Music className="w-6 h-6 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-blue-600">{successRate}%</p>
          <p className="text-sm text-gray-600">Success Rate</p>
        </div>
      </div>

      {/* Time Estimate */}
      {progress.estimatedTimeRemaining && (
        <div className="text-center text-sm text-gray-600">
          <p>Estimated time remaining: {formatTime(progress.estimatedTimeRemaining)}</p>
        </div>
      )}

      {/* Status Messages */}
      {progress.status === 'complete' && (
        <div className="mt-4 p-4 bg-green-100 rounded-lg text-green-800 text-center">
          <CheckCircle className="w-6 h-6 mx-auto mb-2" />
          <p className="font-semibold">Transfer Complete!</p>
          <p className="text-sm">Ready for review</p>
        </div>
      )}

      {progress.status === 'error' && (
        <div className="mt-4 p-4 bg-red-100 rounded-lg text-red-800 text-center">
          <XCircle className="w-6 h-6 mx-auto mb-2" />
          <p className="font-semibold">Transfer Failed</p>
          <p className="text-sm">Please try again</p>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}