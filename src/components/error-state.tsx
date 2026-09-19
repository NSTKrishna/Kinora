import * as React from "react";
import { TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

export function ErrorState({
  title = "Something broke on our side",
  description = "The render queue did not respond. Nothing was charged.",
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/[0.06] px-6 py-16 text-center",
        className,
      )}
    >
      <TriangleAlert className="size-6 text-destructive" />
      <h3 className="text-lg font-medium">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
