import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ state: { data: { ok: true }, showLoader: false, showError: false } }));

vi.mock("@blocks-idp/settings/components/iam-settings-form", () => ({
  IamSettingsForm: ({ config }: { config: unknown }) => <div data-testid="form">{JSON.stringify(config)}</div>,
}));
vi.mock("@blocks-idp/settings/components/config-error-state", () => ({
  ConfigErrorState: () => <div data-testid="error" />,
}));
vi.mock("@blocks-idp/settings/components/settings-tab-loading-state", () => ({
  IamTabLoadingState: () => <div data-testid="loading" />,
}));
vi.mock("@blocks-idp/settings/hooks/use-settings-config", () => ({
  useSettingsAuthConfig: () => ({}),
}));
vi.mock("@blocks-idp/settings/hooks/use-settings-tab-query", () => ({
  getSettingsTabQueryState: () => h.state,
}));

import { IamConfigTab } from "./iam-config-tab";

describe("IamConfigTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.state = { data: { ok: true }, showLoader: false, showError: false };
  });

  it("renders the form when data has loaded", () => {
    render(<IamConfigTab />);
    expect(screen.getByTestId("form").textContent).toContain("ok");
  });

  it("renders the loading state while loading", () => {
    h.state = { data: null, showLoader: true, showError: false };
    render(<IamConfigTab />);
    expect(screen.getByTestId("loading")).toBeTruthy();
  });

  it("renders the error state on error", () => {
    h.state = { data: null, showLoader: false, showError: true };
    render(<IamConfigTab />);
    expect(screen.getByTestId("error")).toBeTruthy();
  });

  it("renders the error state when there is no data", () => {
    h.state = { data: null, showLoader: false, showError: false };
    render(<IamConfigTab />);
    expect(screen.getByTestId("error")).toBeTruthy();
  });
});
