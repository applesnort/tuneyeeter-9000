import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export interface CustomSession {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export async function getCustomSession(): Promise<CustomSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("session-token");
    
    if (!sessionToken) {
      return null;
    }
    
    const decoded = jwt.verify(sessionToken.value, process.env.AUTH_SECRET!) as CustomSession;
    
    // Check if token is expired
    if (decoded.expiresAt && Date.now() > decoded.expiresAt) {
      return null;
    }
    
    return decoded;
  } catch (error) {
    console.error("Session verification failed:", error);
    return null;
  }
}