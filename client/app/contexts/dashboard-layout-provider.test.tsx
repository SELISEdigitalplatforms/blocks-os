import { useContext } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const h = vi.hoisted(() => ({ isMobile: false }));

vi.mock("@/hooks/use-is-mobile", () => ({
  default: () => h.isMobile,
}));

import {
  DashboardLayoutProvider,
  SidebarContext,
} from "./dashboard-layout-provider";

function Consumer() {
  const ctx = useContext(SidebarContext);
  return (
    <div>
      <span data-testid="open">{String(ctx.isSidebarOpen)}</span>
      <span data-testid="search">{ctx.servicesSearchTerm}</span>
      <span data-testid="submenu">{String(ctx.subMenuId)}</span>
      <button onClick={ctx.toggleSidebar}>toggle</button>
      <button onClick={ctx.closeSidebar}>close</button>
      <button onClick={() => ctx.updateServicesSearchTerm("auth")}>search</button>
      <button onClick={() => ctx.updateSubMenuId("services-menu")}>submenu</button>
    </div>
  );
}

const renderProvider = () =>
  render(
    <MemoryRouter>
      <DashboardLayoutProvider isOpen={true}>
        <Consumer />
      </DashboardLayoutProvider>
    </MemoryRouter>,
  );

describe("DashboardLayoutProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isMobile = false;
    localStorage.clear();
  });

  it("delivers an open sidebar to consumers on desktop", () => {
    renderProvider();
    expect(screen.getByTestId("open").textContent).toBe("true");
  });

  it("toggles the sidebar via the context action", async () => {
    const user = userEvent.setup();
    renderProvider();
    expect(screen.getByTestId("open").textContent).toBe("true");

    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("open").textContent).toBe("false");

    await user.click(screen.getByRole("button", { name: "toggle" }));
    expect(screen.getByTestId("open").textContent).toBe("true");
  });

  it("updates the services search term through the context", async () => {
    const user = userEvent.setup();
    renderProvider();
    expect(screen.getByTestId("search").textContent).toBe("");
    await user.click(screen.getByRole("button", { name: "search" }));
    expect(screen.getByTestId("search").textContent).toBe("auth");
  });

  it("persists the sub-menu id to localStorage when updated", async () => {
    const user = userEvent.setup();
    renderProvider();
    await user.click(screen.getByRole("button", { name: "submenu" }));
    expect(screen.getByTestId("submenu").textContent).toBe("services-menu");
    expect(localStorage.getItem("subMenuId")).toBe("services-menu");
  });
});
