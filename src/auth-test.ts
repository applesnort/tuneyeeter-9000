import NextAuth from "next-auth"
import Spotify from "next-auth/providers/spotify"

// Minimal test configuration
export const { handlers: testHandlers, signIn: testSignIn, signOut: testSignOut, auth: testAuth } = NextAuth({
  providers: [
    Spotify({
      clientId: "0c3bafa0d4b742e09ba0b154cbedae45",
      clientSecret: process.env.AUTH_SPOTIFY_SECRET!,
    }),
  ],
})