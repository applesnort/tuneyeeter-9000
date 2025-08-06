"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { TransferResult } from "@/types/transfer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Music, CheckCircle2, AlertCircle, Apple } from "lucide-react"
import toast from "react-hot-toast"

declare global {
  interface Window {
    MusicKit: any;
  }
}

export default function TransferImportPage() {
  const router = useRouter()
  const [transferResult, setTransferResult] = useState<TransferResult | null>(null)
  const [selectedMatches, setSelectedMatches] = useState<Record<string, string>>({})
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [musicKitAuthorized, setMusicKitAuthorized] = useState(false)
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null)
  const [webUrl, setWebUrl] = useState<string | null>(null)
  const [playlistId, setPlaylistId] = useState<string | null>(null)
  const [playlistName, setPlaylistName] = useState("")

  useEffect(() => {
    // Load transfer result and selected matches
    const savedResult = localStorage.getItem("latestTransferResult")
    const savedMatches = localStorage.getItem("selectedMatches")
    
    if (savedResult) {
      const result = JSON.parse(savedResult)
      setTransferResult(result)
      setPlaylistName(result.playlistName)
    }
    if (savedMatches) {
      setSelectedMatches(JSON.parse(savedMatches))
    }
    
    if (!savedResult) {
      router.push("/")
    }
  }, [router])

  useEffect(() => {
    // Load MusicKit JS
    const script = document.createElement('script')
    script.src = 'https://js-cdn.music.apple.com/musickit/v3/musickit.js'
    script.async = true
    script.onload = initializeMusicKit
    document.head.appendChild(script)

    return () => {
      document.head.removeChild(script)
    }
  }, [])

  const initializeMusicKit = async () => {
    try {
      console.log('1. Fetching developer token...')
      // Get developer token from API
      const response = await fetch('/api/musickit-token')
      if (!response.ok) {
        throw new Error(`Token API failed: ${response.status}`)
      }
      const { token, error } = await response.json()
      if (error) {
        throw new Error(`Token generation failed: ${error}`)
      }
      console.log('2. Got developer token, length:', token?.length)
      
      console.log('3. Configuring MusicKit...')
      await window.MusicKit.configure({
        developerToken: token,
        app: {
          name: 'TuneYeeter 9000',
          build: '1.0.0',
        },
      })
      console.log('4. MusicKit configured successfully')
      
      const music = window.MusicKit.getInstance()
      console.log('5. MusicKit instance:', music)
      
      // Check if already authorized
      if (music.isAuthorized) {
        console.log('6. User already authorized')
        setMusicKitAuthorized(true)
      } else {
        console.log('6. User not yet authorized')
      }
    } catch (error) {
      console.error('Failed to initialize MusicKit:', error)
      toast.error(`Failed to initialize Apple Music: ${error.message}`)
    }
  }

  const authorizeMusicKit = async () => {
    try {
      console.log('Starting Apple Music authorization...')
      const music = window.MusicKit.getInstance()
      console.log('Music instance before auth:', music)
      
      const result = await music.authorize()
      console.log('Authorization result:', result)
      
      setMusicKitAuthorized(true)
      toast.success('Authorized with Apple Music!')
    } catch (error) {
      console.error('MusicKit authorization failed:', error)
      toast.error(`Failed to authorize: ${error.message || 'Unknown error'}`)
    }
  }

  const startImport = async () => {
    if (!transferResult || !musicKitAuthorized) return
    
    setIsImporting(true)
    setImportProgress(0)
    
    try {
      const music = window.MusicKit.getInstance()
      const userToken = music.musicUserToken
      
      // Collect all tracks to import
      const tracksToImport: string[] = []
      
      // Add successful transfers
      transferResult.successful.forEach(transfer => {
        tracksToImport.push(transfer.appleTrack.id)
      })
      
      // Add manually selected matches
      Object.values(selectedMatches).forEach(appleTrackId => {
        tracksToImport.push(appleTrackId)
      })
      
      // Create playlist on Apple Music
      console.log('Creating playlist with:', {
        name: playlistName || transferResult.playlistName,
        trackCount: tracksToImport.length,
        userToken: userToken ? 'Present' : 'Missing',
        sampleTrackIds: tracksToImport.slice(0, 3)
      })
      
      const response = await fetch('/api/apple-music/create-playlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'music-user-token': userToken,
        },
        body: JSON.stringify({
          name: playlistName || transferResult.playlistName,
          description: `Imported from Spotify - ${transferResult.totalTracks} tracks`,
          trackIds: tracksToImport,
        }),
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Playlist creation failed:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        })
        throw new Error(`Failed to create playlist: ${response.status} - ${errorText}`)
      }
      
      const { playlistUrl: url, playlistId, webUrl } = await response.json()
      setPlaylistUrl(url)
      setWebUrl(webUrl)
      setPlaylistId(playlistId)
      setImportProgress(100)
      
      toast.success('Playlist created successfully!')
      
      // Clear localStorage
      localStorage.removeItem('latestTransferResult')
      localStorage.removeItem('selectedMatches')
      
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Failed to import playlist')
    } finally {
      setIsImporting(false)
    }
  }

  if (!transferResult) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const totalTracksToImport = transferResult.successfulTransfers + Object.keys(selectedMatches).length
  const failedTracks = transferResult.failures.filter(f => 
    !f.spotifyTrack.id || !selectedMatches[f.spotifyTrack.id]
  ).length

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Apple className="h-6 w-6" />
                Import to Apple Music
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="space-y-2">
                <h3 className="font-semibold">Playlist Summary</h3>
                <input
                  type="text"
                  value={playlistName}
                  onChange={(e) => setPlaylistName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Enter playlist name"
                  disabled={isImporting || !!playlistUrl}
                />
                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {totalTracksToImport}
                    </p>
                    <p className="text-sm text-muted-foreground">Ready to Import</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {failedTracks}
                    </p>
                    <p className="text-sm text-muted-foreground">Cannot Import</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {transferResult.totalTracks}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Tracks</p>
                  </div>
                </div>
              </div>

              {/* Authorization */}
              {!musicKitAuthorized && (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium">Apple Music Authorization Required</p>
                      <p className="text-sm text-muted-foreground">
                        You need to authorize access to your Apple Music library to create playlists.
                      </p>
                    </div>
                  </div>
                  <Button onClick={authorizeMusicKit} className="w-full">
                    <Apple className="mr-2 h-4 w-4" />
                    Authorize Apple Music
                  </Button>
                </div>
              )}

              {/* Import Progress */}
              {isImporting && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Creating playlist...</span>
                    <span>{importProgress}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Success */}
              {playlistUrl && (
                <div className="border rounded-lg p-4 bg-green-500/10 dark:bg-green-500/20">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <p className="font-medium">Playlist Created Successfully!</p>
                      <p className="text-sm text-muted-foreground">
                        {totalTracksToImport} tracks have been added to your Apple Music library.
                      </p>
                      <div className="mt-3 space-y-2">
                        <p className="text-sm font-medium">Your playlist is ready!</p>
                        <div className="text-sm text-muted-foreground space-y-2">
                          <p>The playlist "{playlistName || transferResult.playlistName}" has been created in your Apple Music library.</p>
                          <p className="font-medium mt-2">If the buttons below don't work:</p>
                          <ol className="list-decimal list-inside space-y-1 ml-2">
                            <li>Open the Music app manually</li>
                            <li>Go to Library → Playlists</li>
                            <li>Look for "{playlistName || transferResult.playlistName}"</li>
                            <li>It may take a moment to appear</li>
                          </ol>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        <Button
                          onClick={() => {
                            console.log("Opening playlist with URL:", playlistUrl);
                            console.log("Playlist ID:", playlistId);
                            // Try to open in Music app
                            window.location.href = playlistUrl;
                            // Show a message after a short delay
                            setTimeout(() => {
                              toast("If the Music app didn't open, try the web link below or check your Library → Playlists");
                            }, 2000);
                          }}
                          className="w-full"
                        >
                          <Apple className="mr-2 h-4 w-4" />
                          Open in Apple Music App
                        </Button>
                        {webUrl && (
                          <Button
                            onClick={() => window.open(webUrl, '_blank')}
                            variant="outline"
                            className="w-full"
                          >
                            Open in Web Browser
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                {!playlistUrl && (
                  <Button
                    onClick={startImport}
                    disabled={!musicKitAuthorized || isImporting}
                    className="flex-1"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Music className="mr-2 h-4 w-4" />
                        Import {totalTracksToImport} Tracks
                      </>
                    )}
                  </Button>
                )}
                
                {playlistUrl && (
                  <Button
                    onClick={() => router.push('/')}
                    className="flex-1"
                  >
                    Transfer Another Playlist
                  </Button>
                )}
              </div>

              {/* Failed tracks notice */}
              {failedTracks > 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  {failedTracks} tracks could not be matched and will need to be added manually.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}