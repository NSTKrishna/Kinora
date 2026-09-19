import "server-only";

import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

import { getDb, isDatabaseConfigured } from "@/db";
import { users, type User } from "@/db/schema";
import { SESSION_COOKIE, readSessionToken } from "@/lib/session";
import { grantStarter } from "@/lib/credits";

/**
 * The current visitor, guest or not.
 *
 * Middleware has already put a signed id in the cookie; this is where the row
 * and its starter credits actually get created, on the first server render
 * that needs a user. Returns null when there is no valid session or the
 * database is not configured, so callers degrade instead of throwing.
 */
export async function getCurrentUser(): Promise<User | null> {
  // Read the cookie first, always: it is what marks the render dynamic, so the
  // credit pill is never frozen into a prerendered page.
  const store = await cookies();
  const userId = await readSessionToken(store.get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  if (!isDatabaseConfigured()) return null;

  const db = getDb();

  const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (existing) return existing;

  // First visit: create the guest and grant the starter credits. Both steps are
  // idempotent, so two parallel renders cannot double-grant.
  const [created] = await db
    .insert(users)
    .values({ id: userId, isGuest: true })
    .onConflictDoNothing()
    .returning();

  const user = created ?? (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];

  if (!user) return null;

  await grantStarter(user.id);
  return user;
}

/** For routes that must have a user — API handlers, job creation. */
export async function requireCurrentUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new Error("No session");
  return user;
}
