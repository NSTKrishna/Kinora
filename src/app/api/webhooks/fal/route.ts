import { NextResponse, type NextRequest } from "next/server";

import { getJob, isTerminal, transition } from "@/lib/jobs";
import { getModel } from "@/lib/models";
import { getProvider } from "@/lib/providers";
import { verifyFalWebhook } from "@/lib/fal-webhook";
import { reconcile } from "@/lib/reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * fal calls this when a request finishes. It is one of two paths to the same
 * place — the poller is the other — so everything here is idempotent: a job
 * that already reached a terminal state is acknowledged and ignored.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const verification = await verifyFalWebhook(request.headers, rawBody);
  if (!verification.ok) {
    console.error("[kinora] rejected fal webhook:", verification.reason);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const jobId = request.nextUrl.searchParams.get("job");
  if (!jobId) return NextResponse.json({ error: "missing job" }, { status: 400 });

  const job = await getJob(jobId);
  if (!job) return NextResponse.json({ ok: true, ignored: "unknown job" });
  if (isTerminal(job.status)) return NextResponse.json({ ok: true, ignored: "already final" });

  const payload = JSON.parse(rawBody) as { status?: string; error?: string };
  const model = getModel(job.modelId);
  if (!model) return NextResponse.json({ ok: true, ignored: "unknown model" });

  if (payload.status === "ERROR") {
    await transition(job, {
      status: "failed",
      error: payload.error ?? "The provider reported an error.",
    });
    return NextResponse.json({ ok: true });
  }

  // Success: re-read from the provider rather than trusting the body, so the
  // webhook and the poller cannot disagree about what was produced.
  await reconcile(job, model, getProvider("fal"));
  return NextResponse.json({ ok: true });
}
