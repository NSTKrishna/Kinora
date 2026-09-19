import { describe, expect, it } from "vitest";

import { createSessionToken, readSessionToken, sessionCookieOptions } from "@/lib/session";

const USER = "4d9f7e34-cb25-4969-8b30-c3a1e0ed0d6b";

describe("guest session cookie", () => {
  it("round-trips a signed user id", async () => {
    const token = await createSessionToken(USER);
    expect(await readSessionToken(token)).toBe(USER);
  });

  it("rejects a forged signature", async () => {
    expect(await readSessionToken(`${USER}.deadbeef`)).toBeNull();
  });

  it("rejects a swapped user id", async () => {
    const token = await createSessionToken(USER);
    const signature = token.slice(token.lastIndexOf(".") + 1);
    const other = "11111111-2222-3333-4444-555555555555";
    expect(await readSessionToken(`${other}.${signature}`)).toBeNull();
  });

  it("rejects junk", async () => {
    expect(await readSessionToken(undefined)).toBeNull();
    expect(await readSessionToken("")).toBeNull();
    expect(await readSessionToken("not-a-token")).toBeNull();
    expect(await readSessionToken("not-a-uuid.sig")).toBeNull();
  });

  it("only marks the cookie Secure on https", () => {
    // A Secure cookie on an http origin is never sent back, which would hand
    // every request a new guest and lose the session silently.
    expect(sessionCookieOptions(true).secure).toBe(true);
    expect(sessionCookieOptions(false).secure).toBe(false);
    expect(sessionCookieOptions(false).httpOnly).toBe(true);
  });
});
