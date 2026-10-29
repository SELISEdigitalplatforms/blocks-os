import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { EmailUsageDetailsBreadcrumb } from "./email-usage-details-breadcrumb";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  scopedPath: (p: string) => p,
}));

vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => h.navigate };
});

vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (p: string) => h.scopedPath(p),
}));

const renderCrumb = (props: { id: string; isInbound?: boolean }) =>
  render(
    <MemoryRouter>
      <EmailUsageDetailsBreadcrumb {...props} />
    </MemoryRouter>,
  );

describe("EmailUsageDetailsBreadcrumb", () => {
  beforeEach(() => {
    h.navigate.mockReset();
  });

  it("renders the trail at 14px (text-sm)", () => {
    renderCrumb({ id: "msg-1" });
    const list = document.querySelector("ol");
    expect(list?.className).toContain("text-sm");
  });

  it("renders the leaf id as the current page (font-medium + text-foreground, aria-current=page)", () => {
    renderCrumb({ id: "msg-1" });
    const current = screen.getByText("msg-1");
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(current.className).toContain("font-medium");
    expect(current.className).toContain("text-foreground");
  });

  it("renders the Email link in muted-foreground with hover/focus styling", () => {
    renderCrumb({ id: "msg-1" });
    const link = screen.getByText("Email");
    expect(link.className).toContain("text-muted-foreground");
    expect(link.className).toContain("hover:text-foreground");
    expect(link.className).toContain("focus-visible:ring-ring");
  });

  it("renders separators at size-4 (16px)", () => {
    renderCrumb({ id: "msg-1" });
    const separators = document.querySelectorAll('[role="presentation"]');
    expect(separators.length).toBeGreaterThan(0);
    separators.forEach((sep) => {
      expect(sep.className).toContain("[&>svg]:size-4");
    });
  });
});
