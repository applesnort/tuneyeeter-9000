import NextAuth from "next-auth"
import SpotifyProvider from "next-auth/providers/spotify"

const scopes = "playlist-read-private playlist-read-collaborative"

async function refreshAccessToken(token: any) {
  try {
    const url =
      "https://accounts.spotify.com/api/token?" +
      new URLSearchParams({
        client_id: process.env.AUTH_SPOTIFY_ID!,
        client_secret: process.env.AUTH_SPOTIFY_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      })

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      throw refreshedTokens
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
    }
  } catch (error) {
    console.log(error)

    return {
      ...token,
      error: "RefreshAccessTokenError",
    }
  }
}

const handler = NextAuth({
  providers: [
    SpotifyProvider({
      clientId: process.env.AUTH_SPOTIFY_ID!,
      clientSecret: process.env.AUTH_SPOTIFY_SECRET!,
      authorization: `https://accounts.spotify.com/authorize?scope=${scopes}`,
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial sign in
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: Date.now() + Number(account.expires_in ?? 3600) * 1000,
          user,
        }
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token
      }

      // Access token has expired, try to update it
      return refreshAccessToken(token)
    },
    async session({ session, token }) {
      if (token) {
        // @ts-ignore
        session.accessToken = token.accessToken
        // @ts-ignore
        session.error = token.error
      }
      return session
    },
  },
  session: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
})

export { handler as GET, handler as POST }