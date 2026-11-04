import { Lock } from "lucide-react";
import { PageHeader } from "@/components/page-header/page-header";
import { Button } from "@/components/ui-kits/button/button";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { useGetAiCreditsUsage } from "../../hooks/use-ai-credits";
import { UsageCard } from "../../components/usage-card";
import { RedeemCouponCard } from "../../components/redeem-coupon-card";
import { useT } from "@seliseblocks/genesis-os";

// The project is the impersonated environment tenant in the token, so this page has to stay under
// the `:itemId` routes.
const AiCreditsContent = () => {
  const { t } = useT("os.ai-credits");
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
        <p className="text-sm text-high-emphasis">{t("AI_CREDITS_PAGE.WE_COULD_NOT_LOAD_THE")}</p>
        <Button variant="outline" onClick={() => refetch()}>
          {t("AI_CREDITS_PAGE.TRY_AGAIN")}
        </Button>
      </div>
    );
  }

  if (!usage.enabled) {
    return (
      <p className="text-sm text-medium-emphasis">
        {t("AI_CREDITS_PAGE.AI_CREDITS_ARE_NOT_AVAILABLE")}
      </p>
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
          {t("AI_CREDITS_PAGE.ONLY_A_PROJECT_ADMIN_CAN")}
        </div>
      )}
    </div>
  );
};

// Same frame as the IAM and Logs & Traces pages: a scrolling body with their padding and header.
export const AiCreditsPage = () => {
  const { t } = useT("os.ai-credits");
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
        <PageHeader
          title={t("AI_CREDITS_PAGE.AI_CREDITS")}
          description={t("AI_CREDITS_PAGE.AGENT_CREDIT_BALANCE_FOR_THIS")}
        />
        <AiCreditsContent />
      </div>
    </div>
  );
};
