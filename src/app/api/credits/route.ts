import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth";
import {
  canClaimDaily,
  canPurchase,
  DAILY_CREDITS,
  getBalance,
  grantDaily,
  isPlanId,
  purchasePlan,
  PLANS,
} from "@/lib/credits";
import { apiError, toResponse } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.union([
  z.object({ action: z.literal("claim") }),
  z.object({ action: z.literal("purchase"), plan: z.string() }),
]);

/** Balance plus what is available to top it up with, in one round trip. */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    const [balance, claimable] = await Promise.all([getBalance(user.id), canClaimDaily(user.id)]);

    return NextResponse.json({
      balance,
      claimable,
      dailyAmount: DAILY_CREDITS,
      purchasable: Object.fromEntries(
        await Promise.all(
          (["pro", "max"] as const).map(async (plan) => [plan, await canPurchase(user.id, plan)]),
        ),
      ),
    });
  } catch (error) {
    return toResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("no_session", "Your session expired. Reload the page.", 401);

    const body = bodySchema.parse(await request.json());

    if (body.action === "claim") {
      // grantDaily is idempotent on the day, so a second click is harmless —
      // but say so plainly rather than pretending credits were added.
      const already = !(await canClaimDaily(user.id));
      const balance = await grantDaily(user.id);
      return NextResponse.json({
        balance,
        granted: already ? 0 : DAILY_CREDITS,
        claimable: false,
        message: already ? "You have already claimed today's credits." : undefined,
      });
    }

    if (!isPlanId(body.plan) || PLANS[body.plan].credits <= 0) {
      return apiError("unknown_plan", "That plan does not exist.", 400);
    }

    const already = !(await canPurchase(user.id, body.plan));
    const balance = await purchasePlan(user.id, body.plan);

    return NextResponse.json({
      balance,
      granted: already ? 0 : PLANS[body.plan].credits,
      message: already
        ? `You have already taken today's ${PLANS[body.plan].name} top-up.`
        : undefined,
    });
  } catch (error) {
    return toResponse(error);
  }
}
