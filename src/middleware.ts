import { NextResponse, type NextRequest } from "next/server";

import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
  readSessionToken,
} from "@/lib/session";

/**
 * Guest-first: every visitor leaves with a signed session cookie on their very
 * first request, so nothing in the product needs a sign-in wall.
 *
 * The matching user row and its 30 starter credits are created lazily by
 * getCurrentUser() on the first server render that actually needs them —
 * middleware runs on the edge runtime, which cannot open a pooled Postgres
 * connection, and a DB write on every navigation would be wasteful anyway.
 */
export async function middleware(request: NextRequest) {
  const existing = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (existing) return NextResponse.next();

  const token = await createSessionToken(crypto.randomUUID());
  // Set it on the request too, so the server render happening on this very
  // request already sees the session instead of waiting for the next one.
  request.cookies.set(SESSION_COOKIE, token);
  const response = NextResponse.next({ request });
  response.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)",
  ],
};
