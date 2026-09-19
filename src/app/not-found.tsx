import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export default function NotFound() {
  return (
    <div className="container py-24">
      <EmptyState
        icon={<Compass />}
        title="Nothing here"
        description="That page does not exist on Kinora."
        action={
          <Button asChild>
            <Link href="/">Back to Explore</Link>
          </Button>
        }
      />
    </div>
  );
}
