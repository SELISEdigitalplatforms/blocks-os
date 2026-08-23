import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (segment: string) => `/app/t1/${segment}`,
}));

import { OrganizationConfig } from "./organization-config";

const renderConfig = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("OrganizationConfig", () => {
  it("renders the default trigger linking to the organization-config settings tab", () => {
    renderConfig(<OrganizationConfig />);
    const link = screen.getByRole("link", { name: /configure organization/i });
    expect(link.getAttribute("href")).toBe("/app/t1/iam/settings?settingsTab=organization-config");
  });

  it("uses the outline button variant on the default trigger so it does not outrank the primary Add organization button", () => {
    renderConfig(<OrganizationConfig />);
    const link = screen.getByRole("link", { name: /configure organization/i });
    const button = link.querySelector("button");
    expect(button).toBeTruthy();
    expect(button!.className).toContain("border");
    expect(button!.className).toContain("border-input");
    expect(button!.className).toContain("bg-background");
    expect(button!.className).not.toContain("bg-secondary");
  });

  it("wraps a custom trigger element in the same link", () => {
    renderConfig(<OrganizationConfig trigger={<button>Custom Trigger</button>} />);
    expect(screen.getByRole("button", { name: "Custom Trigger" })).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "/app/t1/iam/settings?settingsTab=organization-config",
    );
  });
});
