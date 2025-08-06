import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET() {
  try {
    // Check environment variables
    if (!process.env.APPLE_PRIVATE_KEY) {
      throw new Error("APPLE_PRIVATE_KEY not set");
    }
    if (!process.env.APPLE_TEAM_ID) {
      throw new Error("APPLE_TEAM_ID not set");
    }
    if (!process.env.APPLE_KEY_ID) {
      throw new Error("APPLE_KEY_ID not set");
    }
    
    const privateKey = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');
    const teamId = process.env.APPLE_TEAM_ID;
    const keyId = process.env.APPLE_KEY_ID;
    
    console.log("Generating MusicKit token...");
    
    const token = jwt.sign({}, privateKey, {
      algorithm: 'ES256',
      expiresIn: '180d',
      issuer: teamId,
      header: {
        alg: 'ES256',
        kid: keyId
      }
    });
    
    console.log("MusicKit token generated successfully");
    
    return NextResponse.json({ token });
  } catch (error) {
    console.error("Failed to generate MusicKit token:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate token" },
      { status: 500 }
    );
  }
}