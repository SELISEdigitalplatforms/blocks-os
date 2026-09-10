import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

Element.prototype.scrollIntoView = vi.fn();

import { TimeRange, type TimeRangeValue } from "./time-range";

// Every expectation is written against UTC instants and UTC clock readings, so these tests
// fail on a local-time implementation and pass regardless of the machine's own timezone.
const FROM = new Date("2026-09-08T10:21:00.000Z");
const TO = new Date("2026-09-08T10:51:00.000Z");

const renderPicker = (
  value: TimeRangeValue,
  onChange = vi.fn(),
  extra: Partial<ComponentProps<typeof TimeRange>> = {},
) => {
  render(
    <TimeRange
      label="Time range"
      value={value}
      onChange={onChange}
      defaultRange={{ from: FROM }}
      openEndHint="now — keeps streaming"
      {...extra}
    />,
  );
  return onChange;
};

const openPicker = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Time range/ }));
  return user;
};

const fromTimeInput = () => screen.getByLabelText("From time (UTC)") as HTMLInputElement;
const toTimeInput = () => screen.getByLabelText("To time (UTC)") as HTMLInputElement;
const applyButton = () => screen.getByRole("button", { name: "Apply" });

describe("TimeRange", () => {
  it("shows the effective window on the trigger, read in UTC", () => {
    renderPicker(null);

    // No range applied yet, so the default window is what the page is actually showing.
    expect(screen.getByText("Sep 08, 2026 10:21 → now UTC")).toBeTruthy();
  });

  it("renders an applied window as a closed UTC interval", () => {
    renderPicker({ from: FROM, to: TO });

    expect(screen.getByText("Sep 08, 2026 10:21 → 10:51 UTC")).toBeTruthy();
  });

  it("offers no relative presets", async () => {
    renderPicker({ from: FROM, to: TO });
    await openPicker();

    expect(screen.queryByText(/Last 30 minutes/i)).toBeNull();
    expect(screen.queryByText(/Last 5 minutes/i)).toBeNull();
    expect(screen.queryByText(/Last 24 hours/i)).toBeNull();
  });

  it("tells the reader that the window is entered in UTC", async () => {
    renderPicker({ from: FROM, to: TO });
    await openPicker();

    expect(screen.getByText(/times are UTC/i)).toBeTruthy();
  });

  it("describes an open end as running to now rather than as a gap to fill", async () => {
    renderPicker(null);
    await openPicker();

    expect(screen.getByText(/now — keeps streaming/i)).toBeTruthy();
    // A time of day would be meaningless against an end that is always the present moment.
    expect(screen.queryByLabelText("To time (UTC)")).toBeNull();
  });

  it("pre-fills both times with their UTC clock reading", async () => {
    renderPicker({ from: FROM, to: TO });
    await openPicker();

    expect(fromTimeInput().value).toBe("10:21");
    expect(toTimeInput().value).toBe("10:51");
  });

  it("reads a typed start time as UTC", async () => {
    const onChange = renderPicker({ from: FROM, to: TO });
    await openPicker();

    fireEvent.change(fromTimeInput(), { target: { value: "06:15" } });
    fireEvent.click(applyButton());

    const applied = onChange.mock.calls[0][0] as { from: Date; to: Date };
    expect(applied.from.toISOString()).toBe("2026-09-08T06:15:00.000Z");
    expect(applied.to.toISOString()).toBe(TO.toISOString());
  });

  it("reads a typed end time as UTC", async () => {
    const onChange = renderPicker({ from: FROM, to: TO });
    await openPicker();

    fireEvent.change(toTimeInput(), { target: { value: "23:45" } });
    fireEvent.click(applyButton());

    const applied = onChange.mock.calls[0][0] as { from: Date; to: Date };
    expect(applied.to.toISOString()).toBe("2026-09-08T23:45:00.000Z");
  });

  it("maps a picked calendar day onto that UTC day", async () => {
    const onChange = renderPicker(null);
    const user = await openPicker();

    // The default window starts on 8 Sep, so picking 9 Sep closes the range on it.
    await user.click(screen.getByText("9"));
    fireEvent.click(applyButton());

    const applied = onChange.mock.calls[0][0] as { from: Date; to: Date };
    expect(applied.from.toISOString()).toBe("2026-09-08T10:21:00.000Z");
    // An end day with no time of its own covers that whole UTC day.
    expect(applied.to.toISOString()).toBe("2026-09-09T23:59:00.000Z");
  });

  it("refuses a window that ends before it starts", async () => {
    const onChange = renderPicker({ from: FROM, to: TO });
    await openPicker();

    fireEvent.change(fromTimeInput(), { target: { value: "11:30" } });

    expect(applyButton()).toHaveProperty("disabled", true);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("hands back to the default window on reset", async () => {
    const onChange = renderPicker({ from: FROM, to: TO });
    await openPicker();

    fireEvent.click(screen.getByRole("button", { name: /Reset to default/i }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  // Traces are listed in local time rather than UTC, so the picker there has to read and
  // write the same clock the reader is comparing against.
  describe("in local time", () => {
    // Built from local parts on purpose: the expectations below then hold in any timezone.
    const LOCAL_FROM = new Date(2026, 8, 8, 11, 9);
    const LOCAL_TO = new Date(2026, 8, 8, 11, 39);

    const renderLocalPicker = (
      value: TimeRangeValue,
      extra: Partial<ComponentProps<typeof TimeRange>> = {},
    ) =>
      renderPicker(value, vi.fn(), {
        timeZone: "local",
        defaultRange: { from: LOCAL_FROM },
        openEndHint: undefined,
        ...extra,
      });

    it("names the local timezone instead of UTC", async () => {
      renderLocalPicker({ from: LOCAL_FROM, to: LOCAL_TO });
      await openPicker();

      expect(screen.getByText(/local timezone/i)).toBeTruthy();
      expect(screen.queryByText(/times are UTC/i)).toBeNull();
      expect(screen.getByLabelText("From time (local)")).toBeTruthy();
    });

    it("pre-fills both times with their local clock reading", async () => {
      renderLocalPicker({ from: LOCAL_FROM, to: LOCAL_TO });
      await openPicker();

      expect((screen.getByLabelText("From time (local)") as HTMLInputElement).value).toBe("11:09");
      expect((screen.getByLabelText("To time (local)") as HTMLInputElement).value).toBe("11:39");
    });

    it("reads a typed time as a local wall clock time", async () => {
      const onChange = renderLocalPicker({ from: LOCAL_FROM, to: LOCAL_TO });
      await openPicker();

      fireEvent.change(screen.getByLabelText("From time (local)"), {
        target: { value: "06:15" },
      });
      fireEvent.click(applyButton());

      const applied = onChange.mock.calls[0][0] as { from: Date; to: Date };
      expect(applied.from.getHours()).toBe(6);
      expect(applied.from.getMinutes()).toBe(15);
      expect(applied.from.getDate()).toBe(8);
    });

    it("maps a picked calendar day onto that local day", async () => {
      const onChange = renderLocalPicker(null);
      const user = await openPicker();

      await user.click(screen.getByText("9"));
      fireEvent.click(applyButton());

      const applied = onChange.mock.calls[0][0] as { from: Date; to: Date };
      expect(applied.to.getDate()).toBe(9);
      expect(applied.to.getHours()).toBe(23);
      expect(applied.to.getMinutes()).toBe(59);
    });

    it("makes no promise about streaming when none was given", async () => {
      renderLocalPicker(null);
      await openPicker();

      expect(screen.getByText("now")).toBeTruthy();
      expect(screen.queryByText(/keeps streaming/i)).toBeNull();
    });
  });

  /**
   * A restored window is a closed set of days. Offering the days around it invites a reader to
   * pick a window the restore never covered and read the empty result as "no logs".
   */
  describe("bounded to a fixed window", () => {
    const BOUNDS = { min: new Date(2026, 7, 1), max: new Date(2026, 7, 7) };

    const dayButton = (day: string) =>
      screen.getByText(day).closest("button") as HTMLButtonElement;

    it("refuses days outside the window", async () => {
      renderPicker(null, vi.fn(), { bounds: BOUNDS, defaultRange: null });
      await openPicker();

      expect(dayButton("15").disabled).toBe(true);
      expect(dayButton("22").disabled).toBe(true);
    });

    it("keeps every day of the window selectable, its last day included", async () => {
      renderPicker(null, vi.fn(), { bounds: BOUNDS, defaultRange: null });
      await openPicker();

      // 6 and 7 are the only two of these that the August grid shows once; the days around the
      // month's edges appear twice, as their own day and as a neighbouring month's outside day.
      expect(dayButton("6").disabled).toBe(false);
      expect(dayButton("7").disabled).toBe(false);
    });

    it("opens on the window rather than on the current month", async () => {
      renderPicker(null, vi.fn(), { bounds: BOUNDS, defaultRange: null });
      await openPicker();

      expect(screen.getByText(/August 2026/)).toBeTruthy();
    });
  });
});
