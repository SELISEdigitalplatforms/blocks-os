import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { useT } from "@seliseblocks/genesis-os";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { useLmtBasePath } from "@/hooks/use-lmt-base-path";
import { cn } from "@/lib/utils";
import { WEBHOOKS_I18N_MODULE } from "../constants/webhooks.constant";
import type { IWebhookAttempt, IWebhookDelivery } from "../models/webhook.model";
import { formatDateTime, prettyJson } from "../utils/format";

const LABEL_CLASS = "mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground";

const isSuccess = (status: number | null): boolean =>
  status !== null && status >= 200 && status < 300;

function AttemptsTable({ attempts }: Readonly<{ attempts: IWebhookAttempt[] }>) {
  const { t } = useT(WEBHOOKS_I18N_MODULE);

  const result = (attempt: IWebhookAttempt): string => {
    if (attempt.httpStatus !== null) {
      return t("HISTORY.HTTP_STATUS", { status: attempt.httpStatus });
    }
    return attempt.errorCode ?? "-";
  };

  return (
    <div className="overflow-hidden rounded-sm border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">{t("HISTORY.ATTEMPT_NO")}</TableHead>
            <TableHead>{t("HISTORY.ATTEMPT_TIME")}</TableHead>
            <TableHead>{t("HISTORY.ATTEMPT_RESULT")}</TableHead>
            <TableHead className="text-right">{t("HISTORY.ATTEMPT_DURATION")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attempts.map((attempt) => (
            <TableRow key={attempt.no}>
              <TableCell className="tabular-nums">{attempt.no}</TableCell>
              <TableCell className="whitespace-nowrap text-xs">
                {formatDateTime(attempt.at)}
              </TableCell>
              <TableCell
                className={cn(
                  "font-mono text-xs",
                  isSuccess(attempt.httpStatus) ? "text-success" : "text-error",
                )}
              >
                {result(attempt)}
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums">
                {t("HISTORY.DURATION_MS", { ms: attempt.durationMs })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Attempts and the exact event that was sent, side by side, plus a link to the delivery's trace. */
export function DeliveryDetails({ delivery }: Readonly<{ delivery: IWebhookDelivery }>) {
  const { t } = useT(WEBHOOKS_I18N_MODULE);
  const lmtBase = useLmtBasePath();
  // Bodies are up to ~8 KB and a page can hold 50 expanded rows: parse once per body, not per render.
  const body = useMemo(() => prettyJson(delivery.body), [delivery.body]);

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="min-w-0">
        <h4 className={LABEL_CLASS}>{t("HISTORY.ATTEMPTS")}</h4>
        {delivery.attempts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("HISTORY.NO_ATTEMPTS")}</p>
        ) : (
          <AttemptsTable attempts={delivery.attempts} />
        )}
      </div>
      <div className="min-w-0">
        <h4 className={LABEL_CLASS}>{t("HISTORY.SENT_BODY")}</h4>
        <div className="relative rounded-sm border bg-card">
          <pre className="max-h-64 overflow-auto p-3 pr-10 font-mono text-xs">
            <code>{body}</code>
          </pre>
          <div className="absolute right-1.5 top-1.5">
            <CopyToClipboardButton textToCopy={delivery.body} label={t("HISTORY.COPY_BODY")}>
              {null}
            </CopyToClipboardButton>
          </div>
        </div>
      </div>
      {delivery.traceId ? (
        <div className="md:col-span-2">
          <Link
            to={`${lmtBase}/tracing/${encodeURIComponent(delivery.traceId)}`}
            className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t("HISTORY.OPEN_TRACE")}</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
