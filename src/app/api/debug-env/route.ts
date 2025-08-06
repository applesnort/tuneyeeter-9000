import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    AUTH_SPOTIFY_ID: process.env.AUTH_SPOTIFY_ID || "NOT SET",
    AUTH_SPOTIFY_SECRET: process.env.AUTH_SPOTIFY_SECRET ? "SET" : "NOT SET",
    AUTH_URL: process.env.AUTH_URL || "NOT SET",
    AUTH_SECRET: process.env.AUTH_SECRET ? "SET" : "NOT SET",
    NODE_ENV: process.env.NODE_ENV,
  })
}