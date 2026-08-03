import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsDismissibleChip } from "./settings-dismissible-chip";

const baseProps = {
  title: "API key",
  confirmTitle: "Remove API key?",
  confirmSubtitle: "This cannot be undone",
  onDismiss: vi.fn(),
};

describe("SettingsDismissibleChip", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the title and optional subtitle", () => {
    render(<SettingsDismissibleChip {...baseProps} subtitle="production" />);
    expect(screen.getByText("API key")).toBeTruthy();
    expect(screen.getByText("production")).toBeTruthy();
  });

  it("hides the remove button in read-only mode", () => {
    render(<SettingsDismissibleChip {...baseProps} readOnly />);
    expect(screen.queryByRole("button", { name: "Remove API key" })).toBeNull();
  });

  it("renders the badge variant", () => {
    const { container } = render(<SettingsDismissibleChip {...baseProps} variant="badge" />);
    expect(container.querySelector(".rounded-xl")).toBeTruthy();
  });

  it("opens the confirmation dialog and dismisses on confirm", async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<SettingsDismissibleChip {...baseProps} onDismiss={onDismiss} />);
    await user.click(screen.getByRole("button", { name: "Remove API key" }));
    await user.click(await screen.findByRole("button", { name: "Remove" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
