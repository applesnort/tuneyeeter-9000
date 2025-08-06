import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import jwt from "jsonwebtoken";

const requestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  trackIds: z.array(z.string()), // Apple Music track IDs
});

// Generate MusicKit developer token
function generateMusicKitToken() {
  const privateKey = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n');
  const teamId = process.env.APPLE_TEAM_ID!;
  const keyId = process.env.APPLE_KEY_ID!;
  
  const token = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '180d',
    issuer: teamId,
    header: {
      alg: 'ES256',
      kid: keyId
    }
  });
  
  return token;
}

export async function POST(request: NextRequest) {
  try {
    console.log("Create playlist endpoint called");
    
    const session = await getServerSession();
    if (!session) {
      console.log("No session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    console.log("Request body:", { 
      name: body.name, 
      trackCount: body.trackIds?.length,
      hasTracks: !!body.trackIds
    });
    
    const { name, description, trackIds } = requestSchema.parse(body);
    
    // Get user token from request header
    const userToken = request.headers.get("music-user-token");
    if (!userToken) {
      return NextResponse.json(
        { error: "Apple Music user token required" },
        { status: 400 }
      );
    }

    console.log("Generating developer token...");
    const developerToken = generateMusicKitToken();
    console.log("Developer token generated, length:", developerToken.length);
    
    const playlistData = {
      attributes: {
        name,
        description: description || `Imported from Spotify on ${new Date().toLocaleDateString()}`,
      },
      relationships: {
        tracks: {
          data: trackIds.map(id => ({
            id,
            type: "songs",
          })),
        },
      },
    };
    
    console.log("Creating playlist with data:", {
      name: playlistData.attributes.name,
      trackCount: playlistData.relationships.tracks.data.length,
      sampleTracks: playlistData.relationships.tracks.data.slice(0, 3)
    });
    
    // Create playlist
    const createPlaylistResponse = await fetch(
      "https://api.music.apple.com/v1/me/library/playlists",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${developerToken}`,
          "Music-User-Token": userToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(playlistData),
      }
    );

    console.log("Apple Music API response status:", createPlaylistResponse.status);
    
    if (!createPlaylistResponse.ok) {
      const errorText = await createPlaylistResponse.text();
      console.error("Apple Music API error:", {
        status: createPlaylistResponse.status,
        error: errorText
      });
      
      // Try to parse error as JSON
      let errorMessage = "Failed to create Apple Music playlist";
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.errors?.[0]?.detail || errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: createPlaylistResponse.status }
      );
    }

    const responseData = await createPlaylistResponse.json();
    console.log("Playlist created successfully:", JSON.stringify(responseData, null, 2));
    
    const playlistId = responseData.data?.[0]?.id || "unknown";
    const playlistType = responseData.data?.[0]?.type || "unknown";
    
    console.log("Extracted playlist details:", {
      playlistId,
      playlistType,
      fullData: responseData.data?.[0]
    });
    
    // For library playlists, we need to use a different URL format
    // The ID returned is in format "p.{id}" for library playlists
    const cleanPlaylistId = playlistId.startsWith('p.') ? playlistId : `p.${playlistId}`;
    
    return NextResponse.json({
      success: true,
      playlistId: playlistId,
      playlistUrl: `music://music.apple.com/library/playlist/${cleanPlaylistId}`,
      webUrl: `https://music.apple.com/library/playlist/${cleanPlaylistId}`,
    });
  } catch (error) {
    console.error("Create playlist error:", error);
    return NextResponse.json(
      { error: "Failed to create playlist" },
      { status: 500 }
    );
  }
}