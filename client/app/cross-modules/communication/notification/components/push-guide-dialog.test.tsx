import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { GUIDE_TEXT, IOS_FAILURES } from "../constants/push-guide.constant";
import { PushGuideDialog } from "./push-guide-dialog";

describe("PushGuideDialog", () => {
  it("shows the guide with the iOS failure causes when open, and closes on Escape", async () => {
    const onClose = vi.fn();
    render(<PushGuideDialog open onClose={onClose} />);
    expect(screen.getByText(GUIDE_TEXT.title)).toBeTruthy();
    expect(screen.getByText(IOS_FAILURES[0].title)).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows nothing while closed", () => {
    render(<PushGuideDialog open={false} onClose={vi.fn()} />);
    expect(screen.queryByText(GUIDE_TEXT.title)).toBeNull();
  });
});
