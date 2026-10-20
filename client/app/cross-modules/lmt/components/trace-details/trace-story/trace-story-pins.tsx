import { Pin, X } from "lucide-react";

export interface StoryPin {
  stepIndex: number;
  label: string;
  value: string;
}

export const MAX_PINS = 8;

export const pinKey = (pin: StoryPin) => `${pin.stepIndex}:${pin.label}`;

export const TraceStoryPins = ({
  pins,
  onSelectStep,
  onRemove,
}: {
  pins: StoryPin[];
  onSelectStep: (index: number) => void;
  onRemove: (pin: StoryPin) => void;
}) => (
  <section
    aria-label="Pinned facts"
    className="flex min-h-12 flex-wrap items-center gap-2 border-t border-border px-4 py-2.5"
  >
    {pins.length === 0 ? (
      <p className="flex items-center gap-2 text-xs text-low-emphasis">
        <Pin size={13} aria-hidden />
        Pin a fact from a step to keep it here while you move through the story.
      </p>
    ) : (
      <>
        <span className="text-xs text-low-emphasis">Pinned</span>
        {pins.map((pin) => (
          <span
            key={pinKey(pin)}
            className="inline-flex max-w-full items-center gap-1 rounded bg-primary/10 py-0.5 pl-2 pr-1 text-xs text-high-emphasis"
          >
            <button
              type="button"
              className="min-w-0 truncate text-left font-mono hover:underline"
              title={`${pin.label}: ${pin.value}`}
              onClick={() => onSelectStep(pin.stepIndex)}
            >
              #{pin.stepIndex + 1} {pin.label}: {pin.value}
            </button>
            <button
              type="button"
              className="rounded p-0.5 text-low-emphasis hover:text-high-emphasis"
              aria-label={`Unpin ${pin.label} of step ${pin.stepIndex + 1}`}
              onClick={() => onRemove(pin)}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {pins.length >= MAX_PINS ? (
          <span className="text-xs text-low-emphasis">Up to {MAX_PINS} pins.</span>
        ) : null}
      </>
    )}
  </section>
);
