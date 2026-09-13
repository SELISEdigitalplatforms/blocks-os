import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRACE_REQUEST_SOURCE_TYPE } from "@blocks-lmt/constants/trace.constant";

const h = vi.hoisted(() => ({ getRetentionDays: vi.fn() }));

vi.mock("@blocks-lmt/hooks/use-trace", () => ({
  useGetRestoredDataRetentionDays: () => h.getRetentionDays(),
}));

import { RequestTracesModal } from "./request-traces-modal";

/**
 * The API states the selectable dates outright. It has to: the window is measured from UTC
 * midnight, and deriving it in the browser means measuring from local midnight instead, which
 * is a different calendar day for part of every day in every non-UTC zone.
 */
const RETENTION = {
  coldDataSelectionDays: 2,
  archiveDataSelectionDays: 5,
  coldEarliestDate: "2026-09-05",
  coldLatestDate: "2026-09-08",
  archiveLatestDate: "2026-09-04",
  coldMaxRangeDays: 4,
  // Deliberately not 7: the replaced code hard-coded 7, so a 7 here would pass either way.
  archiveMaxRangeDays: 10,
};

const givenRetention = (data: unknown, isLoading = false) =>
  h.getRetentionDays.mockReturnValue({ data, isLoading });

const renderModal = (sourceType = TRACE_REQUEST_SOURCE_TYPE.cold) =>
  render(
    <RequestTracesModal
      open
      onOpenChange={vi.fn()}
      sourceType={sourceType}
      isPending={false}
      onSubmit={vi.fn().mockResolvedValue(undefined)}
    />,
  );

/**
 * Selection bounds and copy only. The picked-day serialization these feed into is covered by
 * utils/restore-date-range.test.ts: the calendar itself cannot be opened under jsdom, because
 * react-day-picker focuses a day cell as the popover mounts while the dialog's focus trap pulls
 * focus back, and Radix then dismisses the portalled content.
 */
describe("RequestTracesModal date selection", () => {
  beforeEach(() => {
    givenRetention(RETENTION);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * The regression this guards: the modal used to send
   * `startOfDay(from).toISOString()`, which converts local midnight to UTC. At UTC+6 that turned
   * a picked Sep 5 into `2026-09-04T18:00:00Z`, and the server truncates to the date — so the
   * restore ran for the wrong day, or was refused as outside the cold window.
   */
  it("advertises the maximum span the configuration actually allows", () => {
    renderModal();

    // Not "Max 7 Days": with ColdToArchiveLifeCycleInDays = 3 the cold window is four days wide.
    expect(screen.getByText(/Max 4 Days/i)).toBeTruthy();
  });

  it("advertises the archive maximum span separately from the cold one", () => {
    renderModal(TRACE_REQUEST_SOURCE_TYPE.archive);

    expect(screen.getByText(/Max 10 Days/i)).toBeTruthy();
  });

  /**
   * Bounds are taken verbatim, not recomputed from the day counts. The fixture below is
   * deliberately inconsistent with coldDataSelectionDays for that reason: any client-side
   * arithmetic would land on a different pair of dates than the ones asserted here.
   */
  it("states the cold bounds the API returned rather than recomputing them", () => {
    givenRetention({ ...RETENTION, coldEarliestDate: "2026-08-20", coldLatestDate: "2026-08-24" });

    renderModal();

    expect(screen.getByText(/Aug 20, 2026/)).toBeTruthy();
    expect(screen.getByText(/Aug 24, 2026/)).toBeTruthy();
  });

  it("includes the archive boundary date itself, which is selectable", () => {
    renderModal(TRACE_REQUEST_SOURCE_TYPE.archive);

    // The old copy read "any date before Sep 4", yet Sep 4 was enabled in the calendar.
    expect(screen.getByText(/on or before Sep 4, 2026/i)).toBeTruthy();
    expect(screen.queryByText(/any date before/i)).toBeNull();
  });

  /**
   * While the query is in flight the modal had no bounds to work from and fell back to constants
   * of 31 and 121 days, offering a range made entirely of archive-tier dates. Submitting during
   * that window produced a request the cold tier could not serve.
   */
  it("does not allow a submission before the bounds have loaded", () => {
    givenRetention(undefined, true);

    renderModal();

    expect(screen.getByRole("button", { name: /pick a date range/i })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: /send request/i })).toHaveProperty("disabled", true);
  });
});
