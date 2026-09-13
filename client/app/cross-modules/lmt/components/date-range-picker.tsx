import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange, Matcher } from "react-day-picker";
import { Button } from "@/components/ui-kits/button/button";
import { Calendar } from "@/components/ui-kits/calendar/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  className?: string;
  value?: DateRange;
  onChange?: (date: DateRange | undefined) => void;
  disabledDays?: Matcher | Matcher[];
  maxDays?: number;
  defaultMonth?: Date;
  disabled?: boolean;
}

export function DateRangePicker({
  className,
  value,
  onChange,
  disabledDays,
  maxDays,
  defaultMonth,
  disabled,
}: DateRangePickerProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal sm:w-[300px]",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, "LLL dd, y")} - {format(value.to, "LLL dd, y")}
                </>
              ) : (
                format(value.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value?.from || defaultMonth}
            selected={value}
            onSelect={onChange}
            numberOfMonths={2}
            disabled={disabledDays}
            max={maxDays}
            showOutsideDays={false}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
