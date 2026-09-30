import { useParams, Link } from "react-router";
import { Card } from "@/components/ui-kits/card/card";
import { Button } from "@/components/ui-kits/button/button";
import { useOrderNotifications } from "@blocks-identifier/hooks/use-order-notifications";
import { OrderProgress } from "@blocks-identifier/components/order/order-progress";

/**
 * Watching a purchase being built.
 *
 * Progress arrives by push from the worker, so this page does not poll. It reads the active order
 * once on load — because a refresh loses everything pushed before it existed — and then listens.
 *
 * Only a decline is shown as a failure, and a decline happens before any charge. Once money has
 * moved the page shows progress and nothing else, however long it takes.
 */
export function OrderPage() {
  const { tenantGroupId } = useParams();
  const { order, connected } = useOrderNotifications(tenantGroupId);

  if (!tenantGroupId) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <p className="text-sm font-medium">No project selected</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Setting up</h1>
        <p className="text-sm text-muted-foreground">
          Payment first, then the environments. This usually takes a few minutes.
        </p>
      </div>

      {!order ? (
        <Card className="flex flex-col gap-3 p-6">
          <p className="text-sm font-medium">Nothing is being built right now</p>
          <p className="text-sm text-muted-foreground">
            When you buy an environment or a top-up, its progress appears here.
          </p>
          <div>
            <Button asChild variant="outline" size="sm">
              <Link to={`/project/${tenantGroupId}/checkout`}>Add something</Link>
            </Button>
          </div>
        </Card>
      ) : order.state === "declined" ? (
        <Card className="flex flex-col gap-3 border-destructive p-6">
          <p className="text-base font-semibold">Your card was declined</p>
          <p className="text-sm text-muted-foreground">
            You have not been charged and nothing was created, so there is nothing to undo. Try a
            different card.
          </p>
          <div>
            <Button asChild size="sm">
              <Link to={`/project/${tenantGroupId}/billing`}>Manage cards</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <OrderProgress order={order} />

          {!connected && (
            <p className="text-xs text-muted-foreground">
              Live updates are reconnecting. Everything continues on our side, and this page catches
              up on its own.
            </p>
          )}
        </>
      )}
    </div>
  );
}
