import { NextRequest, NextResponse } from "next/server";
import { generateMusicKitToken } from "@/lib/musickit-token";
import { searchMusicKitByMetadata } from "@/lib/musickit-search";

export async function GET(request: NextRequest) {
  try {
    // Test token generation
    console.log('Testing MusicKit token generation...');
    const token = generateMusicKitToken();
    console.log('Token generated successfully!');
    
    // Test a simple search
    const testTrack = {
      name: "Blinding Lights",
      artists: [{ name: "The Weeknd" }],
      album: { name: "After Hours" },
      duration_ms: 200000,
      external_ids: { isrc: "USUG12000755" }
    };
    
    console.log('Testing search with ISRC...');
    const results = await searchMusicKitByMetadata(testTrack as any);
    
    return NextResponse.json({
      success: true,
      tokenGenerated: true,
      searchResults: results.length,
      firstResult: results[0] || null,
      message: `MusicKit is working! Found ${results.length} results.`
    });
    
  } catch (error) {
    console.error('MusicKit test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      hint: 'Check your .env.local file has all three Apple Music API values'
    }, { status: 500 });
  }
}