import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNode, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool as NodePool } from "pg";

import * as schema from "./schema";

/**
 * Two drivers, one API.
 *
 * Neon is the deployment target and goes over WebSockets — not the HTTP driver,
 * because the credit ledger needs real interactive transactions
 * (SELECT ... FOR UPDATE), which HTTP cannot do. Any other Postgres URL (a local
 * server, CI) uses node-postgres, so the suite can run without a cloud branch.
 */
export type Database = NodePgDatabase<typeof schema>;

let pool: NeonPool | NodePool | undefined;
let cached: Database | undefined;

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function isNeon(url: string) {
  return url.includes("neon.tech") || url.includes("neon.build");
}

/**
 * Lazy on purpose: importing this module must never throw, so a build or a
 * page render without DATABASE_URL degrades instead of crashing.
 */
export function getDb(): Database {
  if (cached) return cached;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  if (isNeon(connectionString)) {
    if (typeof WebSocket === "undefined") {
      // Node (dev server, tests, Vercel node runtime) has no global WebSocket.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      neonConfig.webSocketConstructor = require("ws");
    }
    const neonPool = new NeonPool({ connectionString });
    pool = neonPool;
    // Same query surface as node-postgres; the driver difference stops here.
    cached = drizzleNeon(neonPool, { schema }) as unknown as Database;
  } else {
    const nodePool = new NodePool({ connectionString });
    pool = nodePool;
    cached = drizzleNode(nodePool, { schema });
  }

  return cached;
}

/** Tests only — lets a suite close its connections so the process can exit. */
export async function closeDb() {
  await pool?.end();
  pool = undefined;
  cached = undefined;
}

export { schema };
