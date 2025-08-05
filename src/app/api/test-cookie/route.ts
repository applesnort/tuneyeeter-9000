import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  
  // Try to set a test cookie
  cookieStore.set("test_cookie", "test_value", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 60 * 60,
  });
  
  // Get all cookies
  const allCookies = cookieStore.getAll();
  
  return NextResponse.json({
    setCookieSuccess: true,
    cookies: allCookies.map(c => ({
      name: c.name,
      value: c.value.substring(0, 20) + "..."
    }))
  });
}