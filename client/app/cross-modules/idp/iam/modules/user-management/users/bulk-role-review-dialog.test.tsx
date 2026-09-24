import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BulkRoleReviewDialog } from "./bulk-role-review-dialog";

const preview = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    isSuccess: true,
    errors: null,
    matchedCount: 312,
    affectedCount: 309,
    unchangedCount: 3,
    ...over,
  }) as Parameters<typeof BulkRoleReviewDialog>[0]["preview"];

const renderDialog = (props: Partial<Parameters<typeof BulkRoleReviewDialog>[0]> = {}) =>
  render(
    <BulkRoleReviewDialog
      open
      mode="add"
      organizationLabel="Org One"
      roleSlugs={["viewer"]}
      preview={preview()}
      matchedBy="Everything matching the current filter in Org One"
      isSubmitting={false}
      onOpenChange={vi.fn()}
      onSubmit={vi.fn()}
      {...props}
    />,
  );

beforeEach(() => vi.clearAllMocks());

describe("BulkRoleReviewDialog", () => {
  it("headlines the number that will actually change, not the number matched", () => {
    // matchedCount is the larger, more alarming figure but includes users nothing
    // happens to. Leading with it would overstate every change.
    renderDialog();

    expect(screen.getByTestId("bulk-review-headline").textContent).toContain("309");
    expect(screen.getByTestId("bulk-review-headline").textContent).not.toContain("312");
  });

  it("still shows the matched count, so the two numbers can be reconciled", () => {
    renderDialog();

    expect(screen.getByTestId("bulk-review-matched").textContent).toContain("312 users");
    expect(document.body.textContent).toContain(
      "Everything matching the current filter in Org One",
    );
  });

  it("explains the gap between matched and affected without calling anyone skipped", () => {
    // There is no role cap, so nobody is ever left out for holding too many -- the
    // only reason a matched user does not change is that they already match.
    renderDialog();

    expect(document.body.textContent).toContain("3 of the 312 matched users already hold");
    expect(document.body.textContent).toContain("no per-user role limit");
  });

  it("names the affected count on the submit button", () => {
    renderDialog();

    expect(screen.getByTestId("bulk-review-submit").textContent).toContain("Submit for 309 users");
  });

  it("refuses to submit a change that would write nothing", () => {
    renderDialog({ preview: preview({ affectedCount: 0, unchangedCount: 312 }) });

    expect((screen.getByTestId("bulk-review-submit") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("bulk-review-no-change").textContent).toContain(
      "No user would change",
    );
  });

  it("reads as a removal in remove mode", () => {
    renderDialog({ mode: "remove", roleSlugs: ["editor"] });

    expect(document.body.textContent).toContain("Removing");
    expect(screen.getByText("editor")).toBeTruthy();
  });

  it("says the work is queued rather than done", () => {
    // The worker reports nothing back, so the copy must not imply a result.
    renderDialog();

    expect(document.body.textContent).toContain("background worker");
    expect(document.body.textContent).toContain("Nothing is submitted yet");
  });

  it("hands the submit to the page exactly once per click", () => {
    const onSubmit = vi.fn();
    renderDialog({ onSubmit });

    fireEvent.click(screen.getByTestId("bulk-review-submit"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("locks both footer actions while the submit is in flight", () => {
    renderDialog({ isSubmitting: true });

    expect((screen.getByTestId("bulk-review-submit") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByText("Back") as HTMLButtonElement).disabled).toBe(true);
  });
});
