import { NextRequest, NextResponse } from "next/server";

// Store progress in memory (in production, use Redis or similar)
const transferProgress = new Map<string, any>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const transferId = searchParams.get('transferId');
  
  if (!transferId) {
    return NextResponse.json({ error: "transferId required" }, { status: 400 });
  }
  
  const progress = transferProgress.get(transferId);
  if (!progress) {
    return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
  }
  
  return NextResponse.json(progress);
}

export async function POST(request: NextRequest) {
  const { transferId, ...progress } = await request.json();
  
  if (!transferId) {
    return NextResponse.json({ error: "transferId required" }, { status: 400 });
  }
  
  transferProgress.set(transferId, {
    ...progress,
    lastUpdated: new Date().toISOString()
  });
  
  // Clean up old transfers after 1 hour
  setTimeout(() => {
    transferProgress.delete(transferId);
  }, 60 * 60 * 1000);
  
  return NextResponse.json({ success: true });
}