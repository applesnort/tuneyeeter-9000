import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  
  return NextResponse.json({
    cookies: allCookies.map(c => ({
      name: c.name,
      hasValue: !!c.value,
      length: c.value?.length || 0
    })),
    spotifyToken: !!cookieStore.get("spotify_access_token"),
    refreshToken: !!cookieStore.get("spotify_refresh_token"),
  });
}