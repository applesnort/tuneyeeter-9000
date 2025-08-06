"use client"

import { useState, useEffect } from "react"
import { useSession, signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { 
  ArrowRight, 
  Music, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  Sparkles,
  Timer
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import toast from "react-hot-toast"

export function TransferFormV2() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [playlistUrl, setPlaylistUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [batchProgress, setBatchProgress] = useState<{
    currentBatch: number
    totalBatches: number
    processedTracks: number
    totalTracks: number
  } | null>(null)
  const [stats, setStats] = useState<{
    totalTransfers: number
    successRate: number
  } | null>(null)

  // Load stats from localStorage
  useEffect(() => {
    const savedStats = localStorage.getItem("transferStats")
    if (savedStats) {
      setStats(JSON.parse(savedStats))
    }
  }, [])

  const extractPlaylistId = (input: string): string | null => {
    // Normalize the input by trimming whitespace
    const trimmed = input.trim()
    
    // If it's already just a playlist ID (alphanumeric string)
    if (/^[a-zA-Z0-9]+$/.test(trimmed)) {
      return trimmed
    }
    
    // Extract ID from various URL formats
    // Handle: https://open.spotify.com/playlist/ID?si=... or just /playlist/ID
    const match = trimmed.match(/playlist\/([a-zA-Z0-9]+)/)
    return match ? match[1] : null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!session) {
      toast.error("Please sign in to continue")
      return
    }

    const playlistId = extractPlaylistId(playlistUrl)
    if (!playlistId) {
      toast.error("Please enter a valid Spotify playlist URL or playlist ID")
      return
    }

    setIsLoading(true)
    setBatchProgress(null)

    try {
      let allResults: any = null
      let batchOffset = 0
      const batchSize = 3  // Reduced from 5 to 3 for more conservative timeout handling
      let isComplete = false
      let totalTracks = 0
      let processedTracks = 0
      let currentBatch = 1

      // Process in batches to avoid timeout
      while (!isComplete) {
        console.log(`Starting batch ${currentBatch}, offset ${batchOffset}, size ${batchSize}`)
        
        // Create a timeout controller for the fetch request
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 9000) // 9 second timeout
        
        let batchResult
        try {
          const response = await fetch("/api/transfer-v3", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${session.accessToken}`,
            },
            body: JSON.stringify({ 
              playlistId, 
              batchSize, 
              batchOffset 
            }),
            signal: controller.signal
          })
          
          clearTimeout(timeoutId)

          if (!response.ok) {
            let errorMessage = "Transfer failed"
            
            if (response.status === 504) {
              errorMessage = "Request timed out. Try reducing batch size or check your internet connection."
            } else {
              try {
                const error = await response.json()
                errorMessage = error.error || errorMessage
              } catch {
                // If response isn't JSON (like HTML error page), use generic message
                errorMessage = `Server error (${response.status}). Please try again.`
              }
            }
            throw new Error(errorMessage)
          }
          
          batchResult = await response.json()
        } catch (error) {
          clearTimeout(timeoutId)
          if (error.name === 'AbortError') {
            throw new Error('Request timed out after 9 seconds. The server might be overloaded.')
          }
          throw error
        }
        
        // Initialize totals from first batch
        if (!allResults) {
          totalTracks = batchResult.totalTracks
          allResults = {
            ...batchResult,
            successful: [],
            failures: []
          }
        }
        
        // Combine results from all batches
        allResults.successful.push(...batchResult.successful)
        allResults.failures.push(...batchResult.failures)
        // Don't accumulate - recalculate from actual successful array length
        allResults.successfulTransfers = allResults.successful.length
        
        // Update progress
        processedTracks += batchResult.metadata?.batch?.processedInThisBatch || 0
        const totalBatches = Math.ceil(totalTracks / batchSize)
        
        setBatchProgress({
          currentBatch,
          totalBatches,
          processedTracks,
          totalTracks
        })
        
        // Check if we're done
        isComplete = batchResult.metadata?.batch?.isComplete || false
        batchOffset += batchSize
        currentBatch++
        
        // Small delay between batches to avoid overwhelming the API
        if (!isComplete) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      // Save final combined result to localStorage for review page
      localStorage.setItem("latestTransferResult", JSON.stringify(allResults))
      
      // Update stats
      const newStats = {
        totalTransfers: (stats?.totalTransfers || 0) + 1,
        successRate: Math.round((allResults.successfulTransfers / allResults.totalTracks) * 100)
      }
      setStats(newStats)
      localStorage.setItem("transferStats", JSON.stringify(newStats))
      
      // Check if review is needed (tracks with potential matches to review)
      const needsReview = allResults.failures.some((f: any) => f.possibleMatches && f.possibleMatches.length > 0)
      
      if (needsReview) {
        // Navigate to review page for manual matching
        router.push("/transfer-review")
      } else {
        // All tracks were auto-matched or have no matches - go directly to import
        localStorage.setItem("selectedMatches", JSON.stringify({})) // No manual selections
        router.push("/transfer-import")
      }
    } catch (error) {
      console.error("Transfer error:", error)
      toast.error(error instanceof Error ? error.message : "Transfer failed")
    } finally {
      setIsLoading(false)
      setBatchProgress(null)
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary mb-4">
              <Sparkles className="h-4 w-4" />
              Advanced Track Matching Algorithm
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-4">
              TuneYeeter 9000
            </h1>
            <p className="text-lg text-muted-foreground">
              Move your Spotify playlists to Apple Music with industry-leading accuracy
            </p>
          </div>


          {!session ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-2xl font-semibold mb-2">Get Started</h2>
                <p className="text-muted-foreground mb-6">
                  Sign in with Spotify to begin transferring your playlists
                </p>
                <Button
                  onClick={() => signIn("spotify")}
                  className="w-full sm:w-auto"
                  size="lg"
                >
                  Sign in with Spotify
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="playlist" className="block text-sm font-medium mb-2">
                      Spotify Playlist URL or ID
                    </label>
                    <input
                      type="text"
                      id="playlist"
                      value={playlistUrl}
                      onChange={(e) => setPlaylistUrl(e.target.value)}
                      placeholder="https://open.spotify.com/playlist/... or just playlist ID"
                      className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      required
                      disabled={isLoading}
                    />
                  </div>


                  {batchProgress && (
                    <div className="bg-muted/50 rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Timer className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">
                            Processing Batch {batchProgress.currentBatch} of {batchProgress.totalBatches}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {batchProgress.processedTracks} of {batchProgress.totalTracks} tracks processed
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${(batchProgress.processedTracks / batchProgress.totalTracks) * 100}%` 
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {Math.round((batchProgress.processedTracks / batchProgress.totalTracks) * 100)}% complete
                      </p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {batchProgress ? 'Processing batches...' : 'Analyzing playlist...'}
                      </>
                    ) : (
                      <>
                        Start Transfer
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>No data stored</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Privacy focused</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>Open source</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}