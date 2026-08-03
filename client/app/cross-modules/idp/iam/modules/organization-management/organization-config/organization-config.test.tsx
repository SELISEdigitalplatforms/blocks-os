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

  it("wraps a custom trigger element in the same link", () => {
    renderConfig(<OrganizationConfig trigger={<button>Custom Trigger</button>} />);
    expect(screen.getByRole("button", { name: "Custom Trigger" })).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "/app/t1/iam/settings?settingsTab=organization-config",
    );
  });
});
