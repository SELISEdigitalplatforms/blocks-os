import { Button } from "@/components/ui-kits/button/button";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";

export const ActivityRefreshHeader = () => {
  const queryClient = useQueryClient();
  const [spinning, setSpinning] = useState(false);

  return (
    <Button
      variant="outline"
      size="default"
      className="gap-1 text-sm font-medium"
      data-testid="activity-refresh"
      onClick={() => {
        setSpinning(true);
        void queryClient
          .refetchQueries({ queryKey: ["signup-link-summary"] })
          .finally(() => setSpinning(false));
      }}
    >
      <RefreshCw className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
      <span className="sr-only sm:not-sr-only">Refresh</span>
    </Button>
  );
};
