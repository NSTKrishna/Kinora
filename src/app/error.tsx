"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/error-state";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container py-24">
      <ErrorState
        title="This page failed to load"
        description="Something went wrong rendering Kinora. Try again — no credits were spent."
        action={
          <Button variant="outline" onClick={reset}>
            Try again
          </Button>
        }
      />
    </div>
  );
}
