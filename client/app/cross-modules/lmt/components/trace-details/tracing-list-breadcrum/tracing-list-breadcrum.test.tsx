import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TracingListBreadCrumb } from "./tracing-list-breadcrum";

const h = vi.hoisted(() => ({
  contextValue: {
    traceHistory: [] as Array<{ rootId: string; current: object; root: { spanId: string } }>,
    setTraceHistory: vi.fn(),
    setSelectedTrace: vi.fn(),
    isLoading: false,
  },
}));

vi.mock("../trace-details", () => ({
  timelineContext: {
    Provider: ({ children }: { children: React.ReactNode }) => children,
    Consumer: ({ children }: { children: (v: unknown) => React.ReactNode }) =>
      children(h.contextValue),
  },
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useContext: () => h.contextValue,
  };
});

describe("TracingListBreadCrumb", () => {
  beforeEach(() => {
    h.contextValue.traceHistory = [
      { rootId: "a", current: {}, root: { spanId: "span-1" } },
      { rootId: "b", current: {}, root: { spanId: "span-2" } },
      { rootId: "c", current: {}, root: { spanId: "span-3" } },
    ];
    h.contextValue.isLoading = false;
  });

  it("renders the list at 14px (text-sm) consistent with the main wrapper", () => {
    render(<TracingListBreadCrumb />);
    const list = document.querySelector("ol");
    expect(list?.className).toContain("text-sm");
  });

  it("renders the leaf segment as the current page (font-medium + text-foreground, aria-current=page)", () => {
    render(<TracingListBreadCrumb />);
    const current = screen.getByText("span-3");
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(current.className).toContain("font-medium");
    expect(current.className).toContain("text-foreground");
    expect(current.className).not.toContain("text-low-emphasis");
  });

  it("renders non-current segments as links with muted/hover styling and a focus-visible ring", () => {
    render(<TracingListBreadCrumb />);
    const navLink = screen.getByText("span-1");
    expect(navLink.tagName).toBe("BUTTON");
    expect(navLink.className).toContain("text-muted-foreground");
    expect(navLink.className).toContain("hover:text-foreground");
    expect(navLink.className).toContain("focus-visible:ring-ring");
  });

  it("renders separators at size-4 (16px)", () => {
    render(<TracingListBreadCrumb />);
    const separators = document.querySelectorAll('[role="presentation"]');
    expect(separators.length).toBeGreaterThan(0);
    separators.forEach((sep) => {
      expect(sep.className).toContain("[&>svg]:size-4");
    });
  });

  it("keeps the breadcrumb hidden on small viewports (hidden md:flex)", () => {
    render(<TracingListBreadCrumb />);
    const nav = screen.getByLabelText("breadcrumb");
    expect(nav.className).toContain("hidden");
    expect(nav.className).toContain("md:flex");
  });
});
