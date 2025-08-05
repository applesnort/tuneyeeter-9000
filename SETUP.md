# Music Transfer Setup Guide

## Prerequisites
- Node.js 18+ installed
- Spotify Developer Account (free)

## Quick Start

### 1. Clone and Install
```bash
cd music-transfer
pnpm install
```

### 2. Set up Spotify API
1. Go to https://developer.spotify.com/dashboard
2. Click "Create app"
3. Fill in:
   - App name: "Music Transfer Tool"
   - App description: "Transfer playlists to Apple Music"
   - Redirect URI: `http://127.0.0.1:3000/api/auth/custom-callback` (MUST use 127.0.0.1, not localhost!)
   - Select "Web API" when asked which APIs you're planning to use
4. Save and copy your Client ID and Client Secret

### 3. Configure Environment
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your Spotify credentials:
```
SPOTIFY_CLIENT_ID=0c3bafa0d4b742e09ba0b154cbedae45
SPOTIFY_CLIENT_SECRET=631dca8519f44a49bb63783a3e89cd7f
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/api/spotify/callback
NEXTAUTH_URL=http://127.0.0.1:3000
AUTH_URL=http://127.0.0.1:3000
NEXTAUTH_SECRET=generate_a_random_string_here
ITUNES_API_URL=https://itunes.apple.com/search
```

### 4. Run the App
```bash
pnpm dev
```

Visit http://localhost:3000

## How to Use

1. Click "Connect Spotify Account"
2. Authorize the app
3. Paste a Spotify playlist URL
4. Click "Start Transfer"
5. Review the results:
   - ✅ Successfully matched songs
   - ❌ Failed transfers with detailed reasons
   - 📥 Download reports in JSON or PLIF format

## Testing Tips

Create a test playlist with:
- Popular songs (Taylor Swift, Drake)
- Indie/obscure tracks
- Regional music
- Remixes and covers
- Live versions

This will help you see how the matching algorithm handles different scenarios.

## Features

- **Detailed Failure Reports**: See exactly why each song failed
- **PLIF Export**: Compatible with Playlisty app for manual import
- **Multiple Match Detection**: Identifies when multiple versions exist
- **ISRC Matching**: Uses International Standard Recording Codes when available
- **Fuzzy Matching**: Smart algorithm to find best matches

## Deployment

For production deployment on Vercel:
1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Update Spotify redirect URI to your production URL