import { TimelineAxis, timelineGridStyle } from "../timeline-axis";

interface AnnotationBarProps {
  annotationDuration: number;
}

/** The insights panel is roughly a third of the card, so the strip carries four stops where
 *  the waterfall carries six -- at six they collide at this width. */
const PANEL_INTERVALS = 3;

/**
 * The selected span drawn on its own axis, above the start/finish annotations that describe
 * its two ends. It reuses the waterfall's ruler so a reader moving between the two charts is
 * reading the same scale, and marks the endpoints the annotations below refer to.
 */
const AnnotationBar = ({ annotationDuration }: AnnotationBarProps) => (
  <div className="w-full rounded-md border border-border p-3">
    {/* The transparent right border matches the one the track below carries, so both resolve
        to the same content width and each stop sits on its own hairline. */}
    <TimelineAxis
      duration={annotationDuration}
      intervals={PANEL_INTERVALS}
      className="border-r border-transparent text-[12px]"
    />
    <div
      className="relative mt-1 h-7 border-r border-t border-border"
      style={timelineGridStyle(PANEL_INTERVALS)}
    >
      <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-[2px] bg-chart-purple" />
      {/* The endpoints are what the two annotation rows below are about, so they get a mark
          rather than being left to the reader to infer from the ends of the fill. Each wears
          a ring in the surface colour so it stays legible where it crosses the bar. */}
      <span className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-purple ring-2 ring-card" />
      <span className="absolute left-full top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-purple ring-2 ring-card" />
    </div>
  </div>
);

export default AnnotationBar;
