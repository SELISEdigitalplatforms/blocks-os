import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DateRange } from "react-day-picker";

const h = vi.hoisted(() => ({ onSelect: undefined as ((d: DateRange | undefined) => void) | undefined }));

vi.mock("@seliseblocks/blocks-kit/hooks", () => ({ useIsMobile: () => false }));
vi.mock("@/components/ui-kits/calendar/calendar", () => ({
  Calendar: ({ onSelect }: { onSelect: (d: DateRange | undefined) => void }) => {
    h.onSelect = onSelect;
    return <div data-testid="calendar" />;
  },
}));

import { DateRangeFilter } from "./date-range-filter";

const makeColumn = () => ({ setFilterValue: vi.fn() });

describe("DateRangeFilter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the title without a range when no date is set", () => {
    render(<DateRangeFilter title="Created" date={undefined} onDateChange={vi.fn()} />);
    expect(screen.getByText("Created")).toBeTruthy();
  });

  it("renders the formatted date range in the trigger", () => {
    const date = { from: new Date("2024-01-01"), to: new Date("2024-02-01") };
    render(<DateRangeFilter title="Created" date={date} onDateChange={vi.fn()} />);
    // The trigger includes the separator between from and to dates.
    expect(screen.getByText("Created")).toBeTruthy();
  });

  it("sets a filter value when a full range is selected", async () => {
    const onDateChange = vi.fn();
    const column = makeColumn();
    const user = userEvent.setup();
    render(
      <DateRangeFilter
        column={column as never}
        title="Created"
        date={undefined}
        onDateChange={onDateChange}
      />,
    );
    await user.click(screen.getByRole("button"));
    const range = { from: new Date("2024-01-01"), to: new Date("2024-02-01") };
    h.onSelect?.(range);
    expect(onDateChange).toHaveBeenCalledWith(range);
    expect(column.setFilterValue).toHaveBeenCalledWith(range);
  });

  it("clears the filter value when the range is incomplete", async () => {
    const onDateChange = vi.fn();
    const column = makeColumn();
    const user = userEvent.setup();
    render(
      <DateRangeFilter
        column={column as never}
        title="Created"
        date={undefined}
        onDateChange={onDateChange}
      />,
    );
    await user.click(screen.getByRole("button"));
    h.onSelect?.({ from: new Date("2024-01-01"), to: undefined });
    expect(column.setFilterValue).toHaveBeenCalledWith(undefined);
  });
});
