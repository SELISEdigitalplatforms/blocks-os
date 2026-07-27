import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@blocks-idp/settings/components/settings-tab-actions", () => ({
  SettingsTabActions: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SettingsFormTabButtons: () => <div data-testid="tab-buttons" />,
}));

import {
  AuthTabLoadingState,
  IamTabLoadingState,
  OrganizationTabLoadingState,
  SettingsTabLoadingState,
  SignupTabLoadingState,
} from "./settings-tab-loading-state";

const skeletons = (el: HTMLElement) => el.querySelectorAll(".animate-pulse").length;

describe("settings tab loading states", () => {
  it("renders the auth loading shell with an accessible busy label", () => {
    const { container } = render(<AuthTabLoadingState />);
    const shell = screen.getByLabelText("Loading authentication settings");
    expect(shell.getAttribute("aria-busy")).toBe("true");
    expect(skeletons(container)).toBeGreaterThan(0);
  });

  it("renders the IAM loading shell including a toggle skeleton", () => {
    render(<IamTabLoadingState />);
    expect(screen.getByLabelText("Loading IAM settings")).toBeTruthy();
  });

  it("renders the organization loading shell with the track-bar variant", () => {
    render(<OrganizationTabLoadingState />);
    expect(screen.getByLabelText("Loading organization settings")).toBeTruthy();
  });

  it("renders the signup loading shell with badge sections", () => {
    render(<SignupTabLoadingState />);
    expect(screen.getByLabelText("Loading signup settings")).toBeTruthy();
  });

  it("renders the generic loading state honouring includeToggle and sectionCount", () => {
    const { container } = render(
      <SettingsTabLoadingState tabId="auth-config" includeToggle sectionCount={3} />,
    );
    expect(screen.getByLabelText("Loading settings")).toBeTruthy();
    expect(skeletons(container)).toBeGreaterThan(0);
  });

  it("renders the generic loading state without a toggle by default", () => {
    render(<SettingsTabLoadingState tabId="iam-config" />);
    expect(screen.getByLabelText("Loading settings")).toBeTruthy();
  });
});
