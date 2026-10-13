import { Lock } from "lucide-react";
import { PageHeader } from "@/components/page-header/page-header";
import { Button } from "@/components/ui-kits/button/button";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { useGetAiCreditsUsage } from "../../hooks/use-ai-credits";
import { UsageCard } from "../../components/usage-card";
import { RedeemCouponCard } from "../../components/redeem-coupon-card";

// The project is the impersonated environment tenant in the token, so this page has to stay under
// the `:itemId` routes.
const AiCreditsContent = () => {
  const { data: usage, isLoading, isError, refetch } = useGetAiCreditsUsage();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <Skeleton className="h-72 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !usage) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card px-6 py-5">
        <p className="text-sm text-high-emphasis">
          We could not load the AI credits for this project.
        </p>
        <Button variant="outline" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!usage.enabled) {
    return (
      <p className="text-sm text-medium-emphasis">AI credits are not available for this project.</p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <UsageCard usage={usage} />
      {usage.canTopUp ? (
        <RedeemCouponCard />
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-6 py-4 text-sm text-medium-emphasis">
          <Lock aria-hidden="true" className="h-4 w-4 shrink-0" />
          Only a project admin can redeem coupons.
        </div>
      )}
    </div>
  );
};

// Same frame as the IAM and Logs & Traces pages: a scrolling body with their padding and header.
export const AiCreditsPage = () => (
  <div className="flex h-full min-h-0 flex-col overflow-hidden">
    <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
      <PageHeader
        title="AI Credits"
        description="Agent credit balance for this project and coupon redemption."
      />
      <AiCreditsContent />
    </div>
  </div>
);
