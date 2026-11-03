import { SignJWT, jwtVerify } from "jose";

/**
 * Session token helpers. No database or Node-only imports here, because proxy.ts uses this file too.
 * The token only says who the caller claims to be. Route handlers still load the user from MongoDB
 * on every request (see auth.ts), so deactivating someone or signing them out everywhere takes effect at once.
 */

export const SESSION_COOKIE = "ff_att_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface SessionClaims {
  sub: string;
  /** Matches User.tokenVersion. Bumping it on the user invalidates every token issued before. */
  ver: number;
}

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ ver: claims.ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

/** Returns null for a missing, expired, or tampered token. Never throws on bad input. */
export async function verifySession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  // Outside the try on purpose: a missing secret is a config bug and must not look like "signed out".
  const key = secretKey();
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.ver !== "number") return null;
    return { sub: payload.sub, ver: payload.ver };
  } catch {
    // jose throws for expired or forged tokens; both simply mean "not signed in".
    return null;
  }
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
