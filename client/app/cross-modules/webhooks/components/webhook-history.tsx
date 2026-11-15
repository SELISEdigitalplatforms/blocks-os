import { Fragment, useState, type MouseEvent } from "react";
import { ChevronRight, Info, Loader2, RotateCcw } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";
import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { showErrorToast, showInfoToast, showSuccessToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  HISTORY_PAGE_SIZE,
  WEBHOOK_ERROR_CODES,
  WEBHOOKS_I18N_MODULE,
} from "../constants/webhooks.constant";
import { useGetDeliveries, useResendDelivery } from "../hooks/use-webhooks";
import {
  DELIVERY_STATUSES,
  type DeliveryStatus,
  type IWebhookDelivery,
} from "../models/webhook.model";
import { formatDateTime } from "../utils/format";
import { getErrorCode, webhookErrorMessages } from "../utils/webhook-errors";
import { DeliveryDetails } from "./delivery-details";
import { DeliveryStatusBadge } from "./delivery-status-badge";
import { SectionCardHeader } from "./section-card-header";

const ALL = "all";
const RESENDABLE: ReadonlySet<DeliveryStatus> = new Set<DeliveryStatus>(["Delivered", "Failed"]);
const COLUMN_COUNT = 6;
const SKELETON_ROWS = ["s1", "s2", "s3", "s4"];

interface WebhookHistoryProps {
  webhookId: string;
  /** Actions this webhook receives: the choices of the Action filter. */
  actions: string[];
}

const toggled = (set: ReadonlySet<string>, key: string): Set<string> => {
  const next = new Set(set);
  if (!next.delete(key)) next.add(key);
  return next;
};

const lastError = (delivery: IWebhookDelivery): string | null =>
  delivery.statusReason ?? delivery.attempts.at(-1)?.errorCode ?? null;

export function WebhookHistory({ webhookId, actions }: Readonly<WebhookHistoryProps>) {
  const { t } = useT(WEBHOOKS_I18N_MODULE);
  const [action, setAction] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(HISTORY_PAGE_SIZE);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [resending, setResending] = useState<ReadonlySet<string>>(new Set());
  const { mutateAsync: resend } = useResendDelivery();

  const { data, isLoading, isError, isFetching, refetch } = useGetDeliveries({
    webhookId,
    page: page + 1,
    pageSize,
    ...(action === ALL ? {} : { action }),
    ...(status === ALL ? {} : { status: status as DeliveryStatus }),
  });

  const items = data?.items ?? [];

  const changeFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(0);
  };

  const handleResend = async (delivery: IWebhookDelivery) => {
    setResending((current) => new Set(current).add(delivery.id));
    try {
      await resend(delivery.id);
      showSuccessToast({ description: t("HISTORY.RESEND_QUEUED") });
    } catch (error) {
      const code = getErrorCode(error);
      if (code === WEBHOOK_ERROR_CODES.DeliveryInFlight) {
        showInfoToast({ description: t("ERRORS.DELIVERY_IN_FLIGHT") });
      } else {
        showErrorToast({
          title: t("HISTORY.COULD_NOT_RESEND"),
          errors: code ? { code } : t("ERRORS.UNEXPECTED"),
          customMessages: webhookErrorMessages(),
        });
      }
    } finally {
      setResending((current) => {
        const next = new Set(current);
        next.delete(delivery.id);
        return next;
      });
    }
  };

  const statusLabels: Record<DeliveryStatus, string> = {
    Pending: t("HISTORY.STATUS_PENDING"),
    Retrying: t("HISTORY.STATUS_RETRYING"),
    Delivered: t("HISTORY.STATUS_DELIVERED"),
    Failed: t("HISTORY.STATUS_FAILED"),
    Skipped: t("HISTORY.STATUS_SKIPPED"),
  };

  return (
    <section aria-label={t("HISTORY.TITLE")}>
      <Card className="overflow-hidden p-0">
        <SectionCardHeader title={t("HISTORY.TITLE")} count={data?.totalCount}>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              label={t("HISTORY.FILTER_ACTION")}
              value={action}
              onChange={changeFilter(setAction)}
              options={[
                { value: ALL, label: t("HISTORY.ALL_ACTIONS") },
                ...actions.map((name) => ({ value: name, label: name })),
              ]}
            />
            <FilterSelect
              label={t("HISTORY.FILTER_STATUS")}
              value={status}
              onChange={changeFilter(setStatus)}
              options={[
                { value: ALL, label: t("HISTORY.ALL_STATUSES") },
                ...DELIVERY_STATUSES.map((value) => ({ value, label: statusLabels[value] })),
              ]}
            />
          </div>
        </SectionCardHeader>
        <div className="flex items-start gap-2 border-b bg-muted/40 px-5 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>{t("HISTORY.NOTE")}</p>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-3 px-5 py-4" data-testid="history-loading">
            {SKELETON_ROWS.map((key) => (
              <Skeleton key={key} className="h-8 w-full" />
            ))}
          </div>
        )}
        {isError && (
          <div className="flex items-center gap-3 px-5 py-4 text-sm">
            <span>{t("HISTORY.LOAD_FAILED")}</span>
            <Button variant="outline" size="xs" onClick={() => refetch()}>
              {t("common:RETRY")}
            </Button>
          </div>
        )}
        {items.length === 0 && data && (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("HISTORY.EMPTY")}</p>
        )}
        {data && items.length > 0 && (
          <div className={cn(isFetching && "opacity-70")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <span className="sr-only">{t("HISTORY.EXPAND")}</span>
                  </TableHead>
                  <TableHead>{t("HISTORY.EVENT")}</TableHead>
                  <TableHead>{t("HISTORY.STATUS")}</TableHead>
                  <TableHead className="w-16">{t("HISTORY.TRIES")}</TableHead>
                  <TableHead>{t("HISTORY.LAST_TRY")}</TableHead>
                  <TableHead className="text-right">{t("common:ACTIONS")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((delivery) => (
                  <DeliveryRow
                    key={delivery.id}
                    delivery={delivery}
                    isOpen={open.has(delivery.id)}
                    isResending={resending.has(delivery.id)}
                    onToggle={() => setOpen((current) => toggled(current, delivery.id))}
                    onResend={() => handleResend(delivery)}
                  />
                ))}
              </TableBody>
            </Table>
            <div className="border-t px-5 py-2">
              <Pagination
                page={page}
                pageSize={pageSize}
                totalCount={data.totalCount}
                onChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(0);
                }}
                compact
              />
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

function FilterSelect({ label, value, onChange, options }: Readonly<FilterSelectProps>) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-44" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface DeliveryRowProps {
  delivery: IWebhookDelivery;
  isOpen: boolean;
  isResending: boolean;
  onToggle: () => void;
  onResend: () => void;
}

/** Clicks on the row's own buttons and links (and inside the open panel) must not toggle it. */
const isFromControl = (event: MouseEvent<HTMLElement>): boolean =>
  event.target instanceof Element && event.target.closest("button, a, [role='menuitem']") !== null;

function DeliveryRow({
  delivery,
  isOpen,
  isResending,
  onToggle,
  onResend,
}: Readonly<DeliveryRowProps>) {
  const { t } = useT(WEBHOOKS_I18N_MODULE);
  const reason = lastError(delivery);
  const lastTry = delivery.attempts.at(-1)?.at ?? delivery.lastUpdatedDate;
  const panelId = `delivery-${delivery.id}`;

  // A mouse convenience only: keyboard and screen-reader users toggle with the chevron button,
  // which carries aria-expanded (spec C16), so the row itself is not a focusable control.
  const handleRowClick = (event: MouseEvent<HTMLTableRowElement>) => {
    if (!isFromControl(event)) onToggle();
  };

  return (
    <Fragment>
      <TableRow className="cursor-pointer" onClick={handleRowClick}>
        <TableCell className="w-10">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-expanded={isOpen}
            aria-controls={panelId}
            aria-label={`${t("HISTORY.DETAILS")} ${delivery.eventId}`}
            onClick={onToggle}
          >
            <ChevronRight
              className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")}
              aria-hidden="true"
            />
          </Button>
        </TableCell>
        <TableCell>
          <div className="text-sm font-medium text-high-emphasis">{delivery.action}</div>
          <code className="text-xs text-muted-foreground">{delivery.eventId}</code>
        </TableCell>
        <TableCell>
          <DeliveryStatusBadge status={delivery.status} />
          {reason && <div className="mt-1 font-mono text-xs text-muted-foreground">{reason}</div>}
        </TableCell>
        <TableCell className="tabular-nums">{delivery.attempts.length}</TableCell>
        <TableCell className="whitespace-nowrap text-sm">{formatDateTime(lastTry)}</TableCell>
        <TableCell className="text-right">
          {RESENDABLE.has(delivery.status) && (
            <Button
              variant="ghost"
              size="xs"
              disabled={isResending}
              aria-label={`${t("HISTORY.RESEND")} ${delivery.eventId}`}
              onClick={onResend}
            >
              {isResending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{t("HISTORY.RESEND")}</span>
            </Button>
          )}
        </TableCell>
      </TableRow>
      {isOpen && (
        <TableRow id={panelId}>
          <TableCell colSpan={COLUMN_COUNT} className="bg-muted/40 px-4 pb-5 pt-1 md:pl-14">
            <DeliveryDetails delivery={delivery} />
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}
