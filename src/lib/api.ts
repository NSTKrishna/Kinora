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

/** Turns the errors this app actually throws into honest HTTP responses. */
export function toResponse(error: unknown) {
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
