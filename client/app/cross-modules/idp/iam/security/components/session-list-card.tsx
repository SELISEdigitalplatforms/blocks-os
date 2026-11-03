import { useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { getDeviceIcon } from "@blocks-idp/iam/utils/device-icon";
import { Laptop } from "lucide-react";
import { useUserSessions, useRevokeSession } from "../hooks";
import { toSessionCardViewModel } from "../mappers/session.mapper";
import type { ISessionCardViewModel } from "../view-models/session.view-model";
import { SessionDetailsDrawer } from "./session-details-drawer";
import { useT } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.idp.security";

const LoadingSkeleton = () => (
  <div className="grid gap-2">
    {Array.from({ length: 5 }).map((_, index) => (
      <Skeleton key={index} className="h-14 w-full rounded-lg" />
    ))}
  </div>
);

const EmptyState = () => {
  const { t } = useT(I18N_MODULE);
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Laptop className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">
          {t("SESSION_LIST_CARD.EMPTY_TITLE")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{t("SESSION_LIST_CARD.EMPTY_BODY")}</p>
      </div>
    </div>
  );
};

const SignOutButton = ({
  card,
  onRevoked,
  mutateAsync,
  isPending,
}: {
  card: ISessionCardViewModel;
  onRevoked?: () => void;
  mutateAsync: (vars: { sessionId: string; reason?: string }) => Promise<unknown>;
  isPending: boolean;
}) => {
  const { t } = useT(I18N_MODULE);
  const [open, setOpen] = useState(false);

  const handleConfirm = async () => {
    try {
      await mutateAsync({ sessionId: card.id });
      showSuccessToast({ description: t("SESSION_LIST_CARD.SIGN_OUT_SUCCESS") });
      setOpen(false);
      onRevoked?.();
    } catch (error) {
      showErrorToast({
        errors:
          typeof error === "object" && error !== null && "errors" in error
            ? (error as { errors: unknown }).errors
            : t("SESSION_LIST_CARD.GENERIC_ERROR"),
      });
    }
  };

  if (card.isCurrent) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {t("SESSION_LIST_CARD.SIGN_OUT")}
      </Button>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{t("SESSION_LIST_CARD.CONFIRM_TITLE")}</DialogTitle>
          <DialogDescription>
            {card.deviceName
              ? t("SESSION_LIST_CARD.CONFIRM_DESCRIPTION", { device: card.deviceName })
              : t("SESSION_LIST_CARD.CONFIRM_DESCRIPTION_NO_DEVICE")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("common:CANCEL")}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {isPending ? t("SESSION_LIST_CARD.SIGNING_OUT") : t("SESSION_LIST_CARD.SIGN_OUT")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

type SessionListCardProps = {
  limit?: number;
  showSignOut?: boolean;
  userId?: string;
  /** When set, signing devices out is off, for this reason (e.g. a user the caller cannot manage). */
  readOnlyReason?: string;
};

export const SessionListCard = ({
  showSignOut = true,
  userId,
  readOnlyReason,
}: SessionListCardProps) => {
  const { t } = useT(I18N_MODULE);
  const { isLoading, isFetching, data, refetch } = useUserSessions(userId);
  const { mutateAsync, isPending } = useRevokeSession(userId);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const loading = isLoading || isFetching;
  const cards = (data ?? []).map(toSessionCardViewModel);

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardContent className="flex-1 overflow-y-auto">
        {readOnlyReason ? (
          <p className="mb-2 text-sm text-muted-foreground" data-testid="sessions-read-only">
            {readOnlyReason}
          </p>
        ) : null}
        {loading && <LoadingSkeleton />}
        {!loading &&
          (cards.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {cards.map((card) => {
                const Icon = getDeviceIcon(undefined, card.operatingSystem);
                return (
                  <li
                    key={card.id}
                    className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30"
                    onClick={() => setSelectedSessionId(card.id)}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-high-emphasis">{card.deviceName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t("SESSION_LIST_CARD.DEVICE_DETAILS", {
                            browser: card.browser,
                            os: card.operatingSystem,
                            apps: card.applicationSummary,
                          })}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {t("SESSION_LIST_CARD.LAST_ACTIVE", {
                            ip: card.ipAddress,
                            time: card.lastActivityDisplay,
                          })}
                        </p>
                      </div>
                    </div>
                    <div
                      role="presentation"
                      className="flex shrink-0 items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      {card.isCurrent ? (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                          {t("SESSION_LIST_CARD.THIS_DEVICE")}
                        </span>
                      ) : null}
                      {showSignOut && !readOnlyReason ? (
                        <SignOutButton
                          card={card}
                          onRevoked={() => refetch()}
                          mutateAsync={mutateAsync}
                          isPending={isPending}
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ))}
      </CardContent>

      <SessionDetailsDrawer
        sessionId={selectedSessionId}
        onOpenChange={(open) => !open && setSelectedSessionId(null)}
        onRevoked={() => refetch()}
        userId={userId}
        readOnlyReason={readOnlyReason}
      />
    </Card>
  );
};
