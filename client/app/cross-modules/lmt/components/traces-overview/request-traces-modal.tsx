import React, { useEffect, useState } from "react";
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
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const { data: retentionData } = useGetRestoredDataRetentionDays({ enabled: open });

  useEffect(() => {
    if (!open) {
      setDateRange(undefined);
    }
  }, [open]);

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

  const helperText = !maxDate
    ? "Loading the available range…"
    : minDate
      ? `Allowed range: ${format(minDate, "MMM d, yyyy")} to ${format(maxDate, "MMM d, yyyy")}.`
      // "before" would exclude this date, but it is selectable — cold picks up the day after it.
      : `Allowed range: on or before ${format(maxDate, "MMM d, yyyy")}.`;

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
          <DialogTitle>Request {sourceType} Traces</DialogTitle>
          <DialogDescription>
            Start a new retrieval for {sourceType.toLowerCase()} logs. This process typically takes{" "}
            {sourceType === TRACE_REQUEST_SOURCE_TYPE.cold ? "3-5" : "10-15"} hours.
          </DialogDescription>
        </DialogHeader>

        <Banner variant="warning" title="Warning">
          Requesting {sourceType.toLowerCase()} traces may affect your project's pricing. Please
          continue with caution.
        </Banner>

        <div className="space-y-2 py-4">
          <Label>{maxDays ? `Date Range (Max ${maxDays} Days)` : "Date Range"}</Label>
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
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!boundsReady || !dateRange?.from || !dateRange?.to || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending
              </>
            ) : (
              "Send Request"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
