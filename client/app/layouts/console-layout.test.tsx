import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

vi.mock("@/guards/protected-guard", () => ({
  ProtectedGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ImpersonationChecker: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  ImpersonationTerminator: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@/layouts/console-header/console-header", () => ({
  ConsoleHeader: () => <header>console header</header>,
}));

import { ConsoleLayout } from "./console-layout";

describe("ConsoleLayout", () => {
  it("renders the console header and routed outlet content through its guard stack", () => {
    render(
      <MemoryRouter initialEntries={["/console"]}>
        <Routes>
          <Route path="/console" element={<ConsoleLayout />}>
            <Route index element={<div>console content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("console header")).toBeTruthy();
    expect(screen.getByText("console content")).toBeTruthy();
  });
});
