import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { InsufficientCreditsError } from "@/lib/credits";
import { CapacityError } from "@/lib/guards";
import { ProviderError } from "@/lib/providers";

/** One shape for every error the client has to render. */
export type ApiError = { error: { code: string; message: string } };

export function apiError(code: string, message: string, status: number) {
  return NextResponse.json<ApiError>({ error: { code, message } }, { status });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every `[id]` route takes a uuid. Postgres raises on anything else, which
 * would surface as a 500 — a malformed URL is a "not found", not a fault.
 */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** Turns the errors this app actually throws into honest HTTP responses. */
export function toResponse(error: unknown) {
  // A body that is not JSON is a bad request, not a fault on our side. Without
  // this it reaches the generic handler and reports a 500, which tells the
  // caller to retry something that will never work.
  if (error instanceof SyntaxError) {
    return apiError("invalid_json", "That request body is not valid JSON.", 400);
  }
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return apiError("invalid_input", first?.message ?? "That input is not valid.", 400);
  }
  if (error instanceof CapacityError) {
    return apiError(error.code, error.message, error.status);
  }
  if (error instanceof InsufficientCreditsError) {
    return apiError(
      "insufficient_credits",
      `Not enough credits: this render costs ${error.required} and you have ${error.balance}.`,
      402,
    );
  }
  if (error instanceof ProviderError) {
    return apiError("provider_error", "The render provider rejected that request.", 502);
  }

  console.error("[kinora] unhandled", error);
  return apiError("server_error", "Something went wrong. Nothing was charged.", 500);
}
