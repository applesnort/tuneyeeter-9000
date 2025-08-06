import { NextRequest, NextResponse } from "next/server";

// Redirect all v1 transfer requests to v3
export async function POST(request: NextRequest) {
  // Get the request body and headers
  const body = await request.json();
  
  // Forward to v3 endpoint
  const v3Response = await fetch(`${request.nextUrl.origin}/api/transfer-v3`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': request.headers.get('Authorization') || '',
    },
    body: JSON.stringify(body),
  });

  // Return the v3 response
  if (!v3Response.ok) {
    const error = await v3Response.json();
    return NextResponse.json(error, { status: v3Response.status });
  }

  const result = await v3Response.json();
  return NextResponse.json(result);
}