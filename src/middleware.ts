import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  // Allow test routes to pass through
  if (req.nextUrl.pathname.startsWith("/test-")) {
    return NextResponse.next();
  }
  
  // For other routes, check authentication
  if (!req.auth && req.nextUrl.pathname !== "/") {
    return NextResponse.redirect(new URL("/", req.url));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};