import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Calendar } from "@/components/ui-kits/calendar/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import { Separator } from "@/components/ui-kits/separator/separator";
import { formatFullDate } from "@/lib/utils";
import { Clock, Info } from "lucide-react";
import { useState } from "react";
import { useT } from "@seliseblocks/genesis-os";

/** An absolute window. A missing `to` means "up to now", which keeps the list streaming. */
export type TimeRangeValue = { from?: Date; to?: Date } | null;

interface TimeRangeProps {
  label: string;
  value: TimeRangeValue;
  onChange: (value: TimeRangeValue) => void;
  /** What the page is showing while nothing explicit is applied. */
  defaultRange?: TimeRangeValue;
  /**
   * Which clock the window is written in. It has to be whichever one the list beside it
   * renders its timestamps in, or the reader is comparing a window against times that do
   * not line up with it: logs are listed in UTC, traces in local time.
   */
  timeZone?: "utc" | "local";
  /** How an open end reads. Only a caller that keeps streaming should promise streaming. */
  openEndHint?: string;
  /**
   * The only days that may be picked, as calendar-frame dates in the same zone as `timeZone`.
   * A list over a closed set of data -- restored cold or archive rows -- passes the window it
   * holds, so a reader cannot pick a window the data never covered and read the empty result
   * as an absence of logs. Omitted by a list with no such limit.
   */
  bounds?: { min?: Date; max?: Date };
}

const pad = (value: number) => String(value).padStart(2, "0");

const dayLabel = (date: Date, utc: boolean) => formatFullDate(date, true, utc);
const timeLabel = (date: Date, utc: boolean) =>
  utc
    ? `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
    : `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/**
 * The calendar only speaks local Date objects, so an instant has to be reduced to the day it
 * falls on in the chosen zone -- and a clicked cell has to be read back for its calendar
 * parts and rebuilt as an instant, never passed through as an instant of its own.
 */
const asCalendarDate = (date: Date, utc: boolean) =>
  utc
    ? new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    : new Date(date.getFullYear(), date.getMonth(), date.getDate());

const asInstant = (calendarDay: Date, hours: number, minutes: number, utc: boolean) => {
  const year = calendarDay.getFullYear();
  const month = calendarDay.getMonth();
  const day = calendarDay.getDate();
  return utc
    ? new Date(Date.UTC(year, month, day, hours, minutes))
    : new Date(year, month, day, hours, minutes);
};

const withTime = (instant: Date, time: string, utc: boolean) => {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date(instant);
  if (utc) next.setUTCHours(hours || 0, minutes || 0, 0, 0);
  else next.setHours(hours || 0, minutes || 0, 0, 0);
  return next;
};

const DAY_START = { hours: 0, minutes: 0 };
const DAY_END = { hours: 23, minutes: 59 };

/** Keeps whatever time this end of the range already had, or falls back to the day's edge. */
const carryTime = (
  calendarDay: Date,
  previous: Date | undefined,
  fallback: { hours: number; minutes: number },
  utc: boolean,
) =>
  asInstant(
    calendarDay,
    previous ? (utc ? previous.getUTCHours() : previous.getHours()) : fallback.hours,
    previous ? (utc ? previous.getUTCMinutes() : previous.getMinutes()) : fallback.minutes,
    utc,
  );

const summarize = (
  { from, to }: { from?: Date; to?: Date },
  utc: boolean,
  t: (key: string, values?: Record<string, string>) => string,
) => {
  if (!from) return null;
  const zone = utc ? " UTC" : "";
  const start = `${dayLabel(from, utc)} ${timeLabel(from, utc)}`;
  if (!to) return t("TIME_RANGE.SUMMARY_UNTIL_NOW", { start, zone });
  const end =
    dayLabel(from, utc) === dayLabel(to, utc)
      ? timeLabel(to, utc)
      : `${dayLabel(to, utc)} ${timeLabel(to, utc)}`;
  return t("TIME_RANGE.SUMMARY_RANGE", { start, end, zone });
};

export function TimeRange({
  label,
  value,
  onChange,
  defaultRange = null,
  timeZone = "utc",
  openEndHint,
  bounds,
}: Readonly<TimeRangeProps>) {
  const { t } = useT("os.shared");
  const utc = timeZone === "utc";
  const effective = value ?? defaultRange;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ from?: Date; to?: Date }>({
    from: effective?.from,
    to: effective?.to,
  });

  const summary = summarize({ from: effective?.from, to: effective?.to }, utc, t);
  const endsBeforeItStarts = !!draft.from && !!draft.to && draft.to <= draft.from;
  // Only the ends that were given are enforced, so a half-known window still narrows the picker.
  const disabledDays = [
    ...(bounds?.min ? [{ before: bounds.min }] : []),
    ...(bounds?.max ? [{ after: bounds.max }] : []),
  ];

  // Reopening starts from what the page is showing, never from an abandoned edit.
  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    setDraft({ from: effective?.from, to: effective?.to });
  };

  const handleCalendarSelect = (selected: { from?: Date; to?: Date } | undefined) => {
    setDraft((current) => ({
      from: selected?.from ? carryTime(selected.from, current.from, DAY_START, utc) : undefined,
      to: selected?.to ? carryTime(selected.to, current.to, DAY_END, utc) : undefined,
    }));
  };

  const handleApply = () => {
    if (endsBeforeItStarts || !draft.from) return;
    onChange({ from: draft.from, to: draft.to });
    setOpen(false);
  };

  const handleReset = () => {
    onChange(null);
    setOpen(false);
  };

  const boundary = (
    caption: string,
    instant: Date | undefined,
    emptyLabel: string,
    onTimeChange: (time: string) => void,
  ) => (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-high-emphasis">{caption}</p>
      {instant ? (
        <div className="flex items-center gap-2">
          <span className="flex h-8 flex-1 items-center rounded-md border border-input px-2 text-xs tabular-nums text-medium-emphasis">
            {dayLabel(instant, utc)}
          </span>
          <input
            type="time"
            aria-label={t("TIME_RANGE.BOUNDARY_TIME_LABEL", {
              caption,
              zone: utc ? t("TIME_RANGE.ZONE_UTC") : t("TIME_RANGE.ZONE_LOCAL"),
            })}
            value={timeLabel(instant, utc)}
            onChange={(event) => onTimeChange(event.target.value)}
            className="h-8 w-[92px] rounded-md border border-input bg-background px-2 text-xs tabular-nums"
          />
        </div>
      ) : (
        // No time of day is offered here: it would be meaningless against an end that is
        // always the present moment, and pinning one is what stops the list streaming.
        <span className="flex h-8 items-center rounded-md border border-dashed border-input px-2 text-xs text-medium-emphasis">
          {emptyLabel}
        </span>
      )}
    </div>
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center">
              <Clock className="mr-2 h-4 w-4" />
              <span>{label}</span>
            </div>
            {summary && (
              <>
                <Separator orientation="vertical" className="hidden h-4 sm:mx-2 sm:block" />
                <Badge variant="secondary" className="rounded-sm px-1 font-normal tabular-nums">
                  {summary}
                </Badge>
              </>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex items-start gap-2 border-b px-3 py-2 text-xs text-medium-emphasis">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{utc ? t("TIME_RANGE.TIMES_ARE_UTC") : t("TIME_RANGE.TIMES_ARE_LOCAL")}</span>
        </div>
        <div className="flex flex-col sm:flex-row">
          <Calendar
            mode="range"
            numberOfMonths={1}
            disabled={disabledDays}
            // Bounded windows usually sit months behind today, so the calendar opens on the last
            // day it holds rather than on a current month with nothing selectable in it.
            defaultMonth={
              draft.from ? asCalendarDate(draft.from, utc) : (bounds?.max ?? bounds?.min)
            }
            selected={
              draft.from
                ? {
                    from: asCalendarDate(draft.from, utc),
                    to: draft.to ? asCalendarDate(draft.to, utc) : undefined,
                  }
                : undefined
            }
            onSelect={handleCalendarSelect}
          />
          <div className="flex w-full flex-col gap-3 border-t p-3 sm:w-60 sm:border-l sm:border-t-0">
            {boundary(t("TIME_RANGE.FROM"), draft.from, t("TIME_RANGE.PICK_A_START_DAY"), (time) =>
              setDraft((current) =>
                current.from ? { ...current, from: withTime(current.from, time, utc) } : current,
              ),
            )}
            {boundary(t("TIME_RANGE.TO"), draft.to, openEndHint ?? t("TIME_RANGE.NOW"), (time) =>
              setDraft((current) =>
                current.to ? { ...current, to: withTime(current.to, time, utc) } : current,
              ),
            )}
            {endsBeforeItStarts && (
              <p role="alert" className="text-xs text-error">
                {t("TIME_RANGE.END_BEFORE_START")}
              </p>
            )}
            <div className="mt-auto flex flex-col gap-2 pt-1">
              <Button
                type="button"
                className="w-full"
                onClick={handleApply}
                disabled={endsBeforeItStarts || !draft.from}
              >
                {t("common:APPLY")}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={handleReset}>
                {t("TIME_RANGE.RESET_TO_DEFAULT")}
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
