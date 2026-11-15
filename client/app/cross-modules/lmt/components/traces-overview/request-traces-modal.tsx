import React, { useState } from "react";
import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Label } from "@/components/ui-kits/label/label";
import { TRACE_REQUEST_SOURCE_TYPE } from "@blocks-lmt/constants/trace.constant";
import { useGetRestoredDataRetentionDays } from "@blocks-lmt/hooks/use-trace";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { parseCalendarDay, toUtcCalendarDay } from "@blocks-lmt/utils/restore-date-range";
import { DateRange } from "react-day-picker";
import { DateRangePicker } from "../date-range-picker";
import { useT } from "@seliseblocks/genesis-os";

interface RequestTracesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceType: TRACE_REQUEST_SOURCE_TYPE;
  isPending: boolean;
  onSubmit: (payload: { startDate: string; endDate: string }) => Promise<void>;
}

export function RequestTracesModal({
  open,
  onOpenChange,
  sourceType,
  isPending,
  onSubmit,
}: RequestTracesModalProps) {
  const { t } = useT("os.lmt");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const { data: retentionData } = useGetRestoredDataRetentionDays({ enabled: open });

  // Closing the modal clears the chosen range.
  if (!open && dateRange !== undefined) {
    setDateRange(undefined);
  }

  const handleSend = async () => {
    if (!dateRange?.from || !dateRange?.to) return;

    // Send the calendar day the user clicked, not the instant it maps to. Converting a local
    // midnight with toISOString() shifts the day in every zone but UTC, and the API compares
    // dates — so the restore would run for a day the user did not choose, or be refused as
    // outside the window.
    await onSubmit({
      startDate: toUtcCalendarDay(dateRange.from),
      endDate: toUtcCalendarDay(dateRange.to),
    });
  };

  const isCold = sourceType === TRACE_REQUEST_SOURCE_TYPE.cold;
  const maxDate = parseCalendarDay(
    isCold ? retentionData?.coldLatestDate : retentionData?.archiveLatestDate,
  );
  // Archive keeps blobs until they are deleted, so it has no earliest selectable day.
  const minDate = isCold ? parseCalendarDay(retentionData?.coldEarliestDate) : undefined;
  const maxDays = isCold ? retentionData?.coldMaxRangeDays : retentionData?.archiveMaxRangeDays;

  // Until the API answers there are no bounds to enforce. Falling back to constants here used to
  // offer a range made entirely of archive-tier dates, which the cold tier cannot serve.
  const boundsReady = Boolean(maxDate) && (!isCold || Boolean(minDate));

  let helperText = t("REQUEST_TRACES_MODAL.LOADING_THE_AVAILABLE_RANGE");
  if (maxDate && minDate) {
    helperText = t("REQUEST_TRACES_MODAL.ALLOWED_RANGE_FROM_TO", {
      from: format(minDate, "MMM d, yyyy"),
      to: format(maxDate, "MMM d, yyyy"),
    });
  } else if (maxDate) {
    // "before" would exclude this date, but it is selectable — cold picks up the day after it.
    helperText = t("REQUEST_TRACES_MODAL.ALLOWED_RANGE_ON_OR_BEFORE", {
      to: format(maxDate, "MMM d, yyyy"),
    });
  }

  // Nothing to disable while the bounds are unknown; the picker itself is disabled until then.
  const disabledDays = !maxDate
    ? []
    : minDate
      ? [{ after: maxDate }, { before: minDate }]
      : [{ after: maxDate }];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("REQUEST_TRACES_MODAL.REQUEST_TRACES", { sourceType })}</DialogTitle>
          <DialogDescription>
            {t("REQUEST_TRACES_MODAL.START_A_NEW_RETRIEVAL_FOR", {
              value1: sourceType.toLowerCase(),
              value2: sourceType === TRACE_REQUEST_SOURCE_TYPE.cold ? "3-5" : "10-15",
            })}
          </DialogDescription>
        </DialogHeader>

        <Banner variant="warning" title={t("REQUEST_TRACES_MODAL.WARNING")}>
          {t("REQUEST_TRACES_MODAL.REQUESTING_TRACES_MAY_AFFECT_YOUR", {
            value1: sourceType.toLowerCase(),
          })}
        </Banner>

        <div className="space-y-2 py-4">
          <Label>
            {maxDays
              ? t("REQUEST_TRACES_MODAL.DATE_RANGE_MAX_DAYS", { maxDays })
              : t("REQUEST_TRACES_MODAL.DATE_RANGE")}
          </Label>
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            disabledDays={disabledDays}
            maxDays={maxDays}
            defaultMonth={maxDate}
            disabled={!boundsReady}
          />
          <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("common:CANCEL")}
          </Button>
          <Button
            onClick={handleSend}
            disabled={!boundsReady || !dateRange?.from || !dateRange?.to || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("REQUEST_TRACES_MODAL.SENDING")}
              </>
            ) : (
              t("REQUEST_TRACES_MODAL.SEND_REQUEST")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
