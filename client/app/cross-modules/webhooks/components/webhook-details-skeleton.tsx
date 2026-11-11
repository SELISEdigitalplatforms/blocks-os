import { Card } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";

const FACT_KEYS = ["secret", "created", "failures"];
const ACTION_KEYS = ["a1", "a2", "a3"];
const ROW_KEYS = ["r1", "r2", "r3", "r4"];

/** The detail page's loading state, in the page's own shape (no spinner). */
export function WebhookDetailsSkeleton() {
  return (
    <div className="flex flex-col gap-6" data-testid="webhook-details-loading">
      <Skeleton className="h-4 w-64" />
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6">
          <div className="flex min-w-0 flex-col gap-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className="flex gap-2">
            {ACTION_KEYS.map((key) => (
              <Skeleton key={key} className="h-9 w-24" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 border-t md:grid-cols-3">
          {FACT_KEYS.map((key, index) => (
            <div
              key={key}
              className={
                index === 0
                  ? "px-5 py-4 sm:px-6"
                  : "border-t px-5 py-4 sm:px-6 md:border-l md:border-t-0"
              }
            >
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-4 w-32" />
            </div>
          ))}
        </div>
      </Card>
      <Card className="overflow-hidden p-0">
        <div className="border-b px-5 py-3">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex gap-2 px-5 py-4">
          {ACTION_KEYS.map((key) => (
            <Skeleton key={key} className="h-6 w-32" />
          ))}
        </div>
      </Card>
      <Card className="overflow-hidden p-0">
        <div className="border-b px-5 py-3">
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          {ROW_KEYS.map((key) => (
            <Skeleton key={key} className="h-8 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}
