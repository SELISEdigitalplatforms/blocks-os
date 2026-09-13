import { useMemo } from "react";
import { cn } from "@/lib/utils";

/**
 * The shared time ruler behind both trace charts -- the distributed waterfall and the
 * annotation strip. They measure the same span, so they share one axis rather than each
 * rolling its own: identical stops, identical hairlines, and a plot area addressed in
 * percentages instead of measured pixels, which is what keeps them aligned as the insights
 * panel toggles or the card reflows on mobile.
 */

/** Intervals between stops. Six labelled stops is the most the wide waterfall can carry
 *  without the labels touching; the narrow insights panel asks for fewer. */
const DEFAULT_INTERVALS = 5;

/** Evenly spaced stops from 0 to `duration`, in ms. Built by index rather than by
 *  accumulating `duration / intervals`, which drifts on floating point and intermittently
 *  emits an extra stop past the end of the axis. */
export const buildTicks = (duration: number, intervals: number = DEFAULT_INTERVALS) => {
  const total = Number.isFinite(duration) && duration > 0 ? duration : 0;
  return Array.from({ length: intervals + 1 }, (_, index) => (total * index) / intervals);
};

/**
 * Vertical hairlines at every stop, painted as a repeating background rather than as
 * elements. Rows sit flush against one another, so one gradient per row joins into a single
 * unbroken line down the chart -- and the lines cannot drift out of step with the labels,
 * since both are placed off the same percentage grid. The stop at 100% is left to the
 * element's own right border, which is where it would otherwise be clipped.
 */
export const timelineGridStyle = (intervals: number = DEFAULT_INTERVALS) => ({
  backgroundImage: `repeating-linear-gradient(to right, hsl(var(--border)) 0 1px, transparent 1px ${100 / intervals}%)`,
});

/** Axis stops carry two decimals like the durations they line up with, but drop the trailing
 *  zeros a whole-millisecond stop would otherwise wear. */
const formatTick = (value: number) => String(Number(value.toFixed(2)));

export const TimelineAxis = ({
  duration,
  intervals = DEFAULT_INTERVALS,
  className,
}: {
  duration: number;
  intervals?: number;
  className?: string;
}) => {
  const ticks = useMemo(() => buildTicks(duration, intervals), [duration, intervals]);

  return (
    // The tick size lives on the container so the stops inherit it and a caller can size the
    // whole ruler with one class -- the annotation strip runs a step larger than the
    // waterfall, which needs the tighter size to fit six stops.
    <div className={cn("relative h-4 text-[11px]", className)}>
      {ticks.map((tick, index) => {
        const isFirst = index === 0;
        const isLast = index === ticks.length - 1;

        return (
          <span
            key={`${tick}-${index}`}
            className="absolute top-0 whitespace-nowrap font-medium tabular-nums text-low-emphasis"
            style={{
              left: `${(index / intervals) * 100}%`,
              // The end stops are pulled back inside the plot instead of being centred on
              // their hairline, so the axis never overhangs the card on either side.
              transform: isFirst ? undefined : `translateX(${isLast ? "-100%" : "-50%"})`,
            }}
          >
            {formatTick(tick)}
            {isLast ? " ms" : ""}
          </span>
        );
      })}
    </div>
  );
};
