"use client";

import { useState } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { TransferResult } from "@/types/transfer";
import { CustomSession } from "@/lib/auth-utils";
import { useRouter } from "next/navigation";

interface TransferFormProps {
  onTransferComplete: (results: TransferResult) => void;
  isTransferring: boolean;
  setIsTransferring: (value: boolean) => void;
  session: CustomSession | null;
}

export function TransferForm({ 
  onTransferComplete, 
  isTransferring, 
  setIsTransferring,
  session
}: TransferFormProps) {
  const [playlistUrl, setPlaylistUrl] = useState("");
  const router = useRouter();

  const validateSpotifyUrl = (url: string) => {
    const regex = /^https:\/\/open\.spotify\.com\/playlist\/[a-zA-Z0-9]+/;
    return regex.test(url);
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateSpotifyUrl(playlistUrl)) {
      toast.error("Please enter a valid Spotify playlist URL");
      return;
    }

    if (!session?.accessToken) {
      toast.error("Authentication error. Please sign in again.");
      return;
    }

    setIsTransferring(true);
    
    try {
      const playlistId = playlistUrl.split("/playlist/")[1].split("?")[0];
      const response = await fetch("/api/transfer", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.accessToken}`
        },
        body: JSON.stringify({ playlistId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Transfer failed:", errorData);
        throw new Error(errorData.error || "Transfer failed");
      }

      const results = await response.json();
      onTransferComplete(results);
      toast.success("Transfer completed!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to transfer playlist";
      toast.error(errorMessage);
      console.error("Transfer error:", error);
    } finally {
      setIsTransferring(false);
    }
  };

  if (!session) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-semibold mb-4">Get Started</h2>
        <p className="text-gray-600 mb-6">
          First, connect your Spotify account to access your playlists
        </p>
        <button
          onClick={() => window.location.href = "/api/auth/signin"}
          className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
        >
          Connect Spotify Account
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleTransfer}>
      <div className="mb-6">
        <label htmlFor="playlist-url" className="block text-sm font-medium text-gray-700 mb-2">
          Spotify Playlist URL
        </label>
        <input
          id="playlist-url"
          type="url"
          value={playlistUrl}
          onChange={(e) => setPlaylistUrl(e.target.value)}
          placeholder="https://open.spotify.com/playlist/..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          required
        />
        <p className="mt-2 text-sm text-gray-500">
          Copy the share link from your Spotify playlist
        </p>
      </div>

      <button
        type="submit"
        disabled={isTransferring}
        className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isTransferring ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Transferring Playlist...
          </>
        ) : (
          "Start Transfer"
        )}
      </button>

      <button
        type="button"
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.refresh();
        }}
        className="mt-3 w-full text-gray-600 text-sm hover:text-gray-800 transition-colors"
      >
        Disconnect Spotify Account
      </button>
    </form>
  );
}