import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET() {
  const diagnostics = {
    environment: {
      APPLE_TEAM_ID: process.env.APPLE_TEAM_ID ? "✓ Set" : "✗ Missing",
      APPLE_KEY_ID: process.env.APPLE_KEY_ID ? "✓ Set" : "✗ Missing",
      APPLE_PRIVATE_KEY: process.env.APPLE_PRIVATE_KEY ? "✓ Set" : "✗ Missing",
    },
    token: {
      generated: false,
      error: null as string | null,
      decoded: null as any,
    }
  };

  try {
    if (process.env.APPLE_PRIVATE_KEY && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID) {
      const privateKey = process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n');
      
      const token = jwt.sign({}, privateKey, {
        algorithm: 'ES256',
        expiresIn: '180d',
        issuer: process.env.APPLE_TEAM_ID,
        header: {
          alg: 'ES256',
          kid: process.env.APPLE_KEY_ID
        }
      });
      
      diagnostics.token.generated = true;
      diagnostics.token.decoded = jwt.decode(token, { complete: true });
    }
  } catch (error) {
    diagnostics.token.error = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json(diagnostics, { 
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    }
  });
}