import { Button } from "@/components/ui-kits/button/button";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { Activity, Ticket } from "lucide-react";
import { Link } from "react-router";

export const ActivityChooseState = () => (
  <div
    className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl py-16 text-center"
    data-testid="activity-choose"
  >
    <Activity className="h-6 w-6 text-muted-foreground" />
    <p className="text-sm text-muted-foreground">
      Choose a configuration to see its activity.
    </p>
  </div>
);

export const ActivityNoneState = () => {
  const scoped = useScopedPath();
  return (
    <div
      className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl py-16 text-center"
      data-testid="activity-none"
    >
      <Ticket className="h-6 w-6 text-muted-foreground" />
      <h2 className="text-base font-semibold text-high-emphasis">
        No signup link configurations yet.
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Create a configuration first, then return here to review link activity counts.
      </p>
      <Link to={scoped("iam/signup-link-configurations")}>
        <Button variant="outline">Go to Signup Link Configurations</Button>
      </Link>
    </div>
  );
};

export const ActivityEmptyState = () => (
  <div
    className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl py-16 text-center"
    data-testid="activity-empty"
  >
    <p className="text-sm text-muted-foreground">
      No links generated from this configuration in this range.
    </p>
  </div>
);

export const ActivityUnknownState = () => (
  <div
    className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl py-16 text-center"
    data-testid="activity-unknown"
  >
    <p className="text-sm text-muted-foreground">This configuration is no longer available.</p>
  </div>
);

export const ActivityForbiddenState = () => (
  <div
    className="flex min-h-[320px] items-center justify-center rounded-xl py-16 text-center text-sm text-muted-foreground"
    data-testid="activity-forbidden"
  >
    You do not have permission to view signup link activity.
  </div>
);

export const ActivityErrorState = ({ onRetry }: { onRetry: () => void }) => (
  <div
    className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl py-16 text-center text-sm text-muted-foreground"
    data-testid="activity-error"
  >
    <p>Something went wrong loading signup link activity.</p>
    <Button variant="outline" onClick={onRetry}>
      Retry
    </Button>
  </div>
);
