import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { Button } from "@/components/ui-kits/button/button";
import { useOrderNotifications } from "@blocks-identifier/hooks/use-order-notifications";
import { useCatalogue } from "@blocks-identifier/hooks/use-catalogue";
import { OrderProgress } from "@blocks-identifier/components/order/order-progress";

/**
 * Payment and creation.
 *
 * Pay lands here, not on the console: a purchase is in flight for minutes and this is the screen
 * that tells the truth about it. Progress arrives by push, so the page does not poll; it reads the
 * order once on load (`?order=` when it was opened for one) because a refresh loses everything
 * pushed before it existed.
 */
export function OrderPage() {
  const { tenantGroupId } = useParams();
  const [params] = useSearchParams();
  const orderId = params.get("order");
  const { order, connected } = useOrderNotifications(tenantGroupId, orderId);
  const { data: catalogue } = useCatalogue();
  const base = `/app/project/${tenantGroupId}`;
  // Opened for a brand-new project (/app/creating/…): until an environment exists the project
  // pages would bounce, so everything but "Open the project" leads back to the console.
  const isNewProject = useLocation().pathname.startsWith("/app/creating/");
  const consoleHref = isNewProject ? "/app/console" : `${base}/environments`;

  if (!tenantGroupId) {
    return (
      <div className="p-6">
        <p className="text-sm font-medium">No project selected</p>
      </div>
    );
  }

  const labels = Object.fromEntries(
    Object.entries(catalogue?.environments ?? {}).map(([key, env]) => [key, env.label]),
  );

  return (
    <div className="flex max-w-[860px] flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-high-emphasis">
          Payment and creation
        </h1>
        <p className="text-[13px] text-medium-emphasis">
          Payment is taken first; the environments are then built in the background.
        </p>
      </div>

      {!order ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium">Nothing is being built right now</p>
          <p className="text-[13px] text-medium-emphasis">
            When you buy an environment or a top-up, its progress appears here.
          </p>
          <div>
            <Button asChild variant="outline" size="sm">
              <Link to={consoleHref}>
                {isNewProject ? "Back to the console" : "Go to environments"}
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <OrderProgress order={order} labels={labels} />

          {!connected && order.state !== "created" && order.state !== "declined" && (
            <p className="text-xs text-medium-emphasis">
              Live updates are reconnecting. Everything continues on our side, and this page catches
              up on its own.
            </p>
          )}

          <div className="flex flex-wrap gap-2.5">
            {order.state === "created" && (
              <>
                <Button asChild>
                  <Link to={`${base}/environments`}>Open the project</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to={`${base}/subscription-usage`}>See usage</Link>
                </Button>
              </>
            )}
            {order.state === "declined" && (
              <>
                {!isNewProject && (
                  <Button asChild>
                    <Link to={`${base}/billing/cards`}>Try another card</Link>
                  </Button>
                )}
                <Button asChild variant="outline">
                  <Link to={consoleHref}>
                    {isNewProject ? "Back to the console" : "Go to environments"}
                  </Link>
                </Button>
              </>
            )}
            {order.state === "expired" && (
              <Button asChild variant="outline">
                <Link to={consoleHref}>Back</Link>
              </Button>
            )}
            {order.state !== "created" &&
              order.state !== "declined" &&
              order.state !== "expired" && (
                <Button asChild variant="outline">
                  <Link to={consoleHref}>Go to the console</Link>
                </Button>
              )}
          </div>
        </>
      )}
    </div>
  );
}
