import { Fragment, useState } from "react";
import { Loader2 } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";
import { Button } from "@/components/ui-kits/button/button";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { showErrorToast, showInfoToast, showSuccessToast } from "@/hooks/use-toast";
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

const ALL = "all";
const RESENDABLE: readonly DeliveryStatus[] = ["Delivered", "Failed"];

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
    <section className="flex flex-col gap-3" aria-label={t("HISTORY.TITLE")}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-base font-semibold text-high-emphasis">{t("HISTORY.TITLE")}</h2>
        <div className="flex flex-wrap items-center gap-3">
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
      </div>
      <p className="text-xs text-muted-foreground">{t("HISTORY.NOTE")}</p>

      {isLoading && (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-3 text-sm">
          <span>{t("HISTORY.LOAD_FAILED")}</span>
          <Button variant="outline" size="xs" onClick={() => refetch()}>
            {t("common:RETRY")}
          </Button>
        </div>
      )}
      {items.length === 0 && data && (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("HISTORY.EMPTY")}</p>
      )}
      {data && items.length > 0 && (
        <div
          className={`overflow-hidden rounded-sm border border-border bg-card ${isFetching ? "opacity-70" : ""}`}
        >
          <Table>
            <TableHeader>
              <TableRow>
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
      )}
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
      <SelectTrigger className="h-9 w-48" aria-label={label}>
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

  return (
    <Fragment>
      <TableRow>
        <TableCell>
          <div className="text-sm font-medium text-high-emphasis">{delivery.action}</div>
          <code className="text-xs text-muted-foreground">{delivery.eventId}</code>
        </TableCell>
        <TableCell>
          <DeliveryStatusBadge status={delivery.status} />
          {reason && <div className="mt-1 font-mono text-xs text-muted-foreground">{reason}</div>}
        </TableCell>
        <TableCell>{delivery.attempts.length}</TableCell>
        <TableCell className="text-sm">{formatDateTime(lastTry)}</TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="xs"
              aria-expanded={isOpen}
              aria-controls={panelId}
              aria-label={`${t("HISTORY.DETAILS")} ${delivery.eventId}`}
              onClick={onToggle}
            >
              {isOpen ? t("HISTORY.HIDE") : t("HISTORY.DETAILS")}
            </Button>
            {RESENDABLE.includes(delivery.status) && (
              <Button
                variant="outline"
                size="xs"
                disabled={isResending}
                aria-label={`${t("HISTORY.RESEND")} ${delivery.eventId}`}
                onClick={onResend}
              >
                {isResending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                <span>{t("HISTORY.RESEND")}</span>
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {isOpen && (
        <TableRow id={panelId}>
          <TableCell colSpan={5} className="bg-muted/30">
            <DeliveryDetails delivery={delivery} />
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}
