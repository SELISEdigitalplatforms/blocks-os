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
import {
  ARCHIVE_TRACE_RANGE_DAYS,
  COLD_TRACE_RANGE_DAYS,
  MAX_TRACE_REQUEST_DAYS,
  TRACE_REQUEST_SOURCE_TYPE,
} from "@blocks-lmt/constants/trace.constant";
import { useGetRestoredDataRetentionDays } from "@blocks-lmt/hooks/use-trace";
import { endOfDay, format, startOfDay, subDays } from "date-fns";
import { Loader2 } from "lucide-react";
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
    const formatUtcDate = (date: Date) => `${date.toISOString().slice(0, 19)}Z`;

    await onSubmit({
      startDate: formatUtcDate(startOfDay(dateRange.from)),
      endDate: formatUtcDate(endOfDay(dateRange.to)),
    });
  };

  const coldDays = retentionData?.coldDataSelectionDays ?? COLD_TRACE_RANGE_DAYS.MIN;
  const archiveDays = retentionData?.archiveDataSelectionDays ?? ARCHIVE_TRACE_RANGE_DAYS.MIN;
  const today = startOfDay(new Date());
  const maxDate =
    sourceType === TRACE_REQUEST_SOURCE_TYPE.cold
      ? subDays(today, coldDays)
      : subDays(today, archiveDays + 1);
  const minDate =
    sourceType === TRACE_REQUEST_SOURCE_TYPE.cold ? subDays(today, archiveDays) : undefined;
  const helperText = minDate
    ? `Allowed range: ${format(minDate, "MMM d, yyyy")} to ${format(maxDate, "MMM d, yyyy")}.`
    : `Allowed range: any date before ${format(maxDate, "MMM d, yyyy")}.`;
  const disabledDays = minDate ? [{ after: maxDate }, { before: minDate }] : [{ after: maxDate }];

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
          <Label>Date Range (Max {MAX_TRACE_REQUEST_DAYS} Days)</Label>
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            disabledDays={disabledDays}
            maxDays={MAX_TRACE_REQUEST_DAYS}
            defaultMonth={maxDate}
          />
          <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!dateRange?.from || !dateRange?.to || isPending}>
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
