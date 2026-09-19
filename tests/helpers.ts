import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { users } from "@/db/schema";

export function requireTestDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and point it at a Neon branch before running the credit tests.",
    );
  }
}

/** A throwaway guest with no ledger entries yet. */
export async function createTestUser(): Promise<string> {
  const [user] = await getDb().insert(users).values({ isGuest: true }).returning();
  return user.id;
}

/** Cascades to the ledger, so no per-table cleanup is needed. */
export async function deleteTestUser(userId: string) {
  await getDb().delete(users).where(eq(users.id, userId));
}
