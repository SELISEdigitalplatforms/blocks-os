import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SetCustomDomainForm } from "./form";

const baseProps = {
  defaultDomain: "app.example.com",
  verifiedDomains: ["app.example.com", "www.example.com"],
  isPending: false,
  onSubmit: vi.fn().mockResolvedValue(undefined),
  onCancel: vi.fn(),
};

describe("SetCustomDomainForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the selected default domain", () => {
    render(<SetCustomDomainForm {...baseProps} />);
    expect(screen.getByText("app.example.com")).toBeTruthy();
  });

  it("disables the select and shows an empty placeholder when there are no verified domains", () => {
    render(<SetCustomDomainForm {...baseProps} defaultDomain="" verifiedDomains={[]} />);
    expect(screen.getByText("No verified domains available")).toBeTruthy();
    expect((screen.getByRole("combobox") as HTMLButtonElement).disabled).toBe(true);
  });

  it("submits the selected domain", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SetCustomDomainForm {...baseProps} onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "Set" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("app.example.com"));
  });

  it("calls onCancel from the cancel button", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<SetCustomDomainForm {...baseProps} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("disables the Set button while pending", () => {
    render(<SetCustomDomainForm {...baseProps} isPending />);
    expect((screen.getByRole("button", { name: "Set" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
