import { redirect } from "next/navigation";

export async function GET() {
  // Build the Spotify OAuth URL manually with 127.0.0.1
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: "http://127.0.0.1:3000/api/auth/custom-callback",
    scope: "playlist-read-private playlist-read-collaborative",
    show_dialog: "true",
  });
  
  const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
  
  redirect(authUrl);
}