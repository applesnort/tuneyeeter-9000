"use client";

import { useState } from "react";
import { Music, ArrowRight, AlertCircle } from "lucide-react";
import { TransferForm } from "@/components/TransferForm";
import { TransferResults } from "@/components/TransferResults";
import { TransferResult } from "@/types/transfer";

import { CustomSession } from "@/lib/auth-utils";

export function TransferPage({ session }: { session: CustomSession | null }) {
  const [results, setResults] = useState<TransferResult | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Music className="w-10 h-10 text-green-600" />
            <ArrowRight className="w-6 h-6 text-gray-600" />
            <Music className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Music Transfer
          </h1>
          <p className="text-lg text-gray-600">
            Transfer your Spotify playlists to Apple Music with detailed reporting
          </p>
        </header>

        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">How to test this tool:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Create a test playlist on Spotify with various songs</li>
                    <li>Include popular songs, indie tracks, and regional music</li>
                    <li>Use the tool to see which songs transfer successfully</li>
                    <li>Review the detailed report for any failures</li>
                  </ol>
                </div>
              </div>
            </div>

            {!results ? (
              <TransferForm 
                onTransferComplete={setResults}
                isTransferring={isTransferring}
                setIsTransferring={setIsTransferring}
                session={session}
              />
            ) : (
              <TransferResults 
                results={results}
                onStartNew={() => setResults(null)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}