import NextAuth from "next-auth"
import SpotifyProvider from "next-auth/providers/spotify"

const scopes = "playlist-read-private playlist-read-collaborative"

export default NextAuth({
  providers: [
    SpotifyProvider({
      clientId: process.env.AUTH_SPOTIFY_ID!,
      clientSecret: process.env.AUTH_SPOTIFY_SECRET!,
      authorization: `https://accounts.spotify.com/authorize?scope=${scopes}`,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      return session
    },
  },
})

// For Next.js 13+ app directory
export const { handlers, signIn, signOut, auth } = {
  handlers: { GET: NextAuth, POST: NextAuth },
  signIn: async () => { throw new Error("Use NextAuth API routes") },
  signOut: async () => { throw new Error("Use NextAuth API routes") },
  auth: async () => null,
}