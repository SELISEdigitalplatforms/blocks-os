import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Home } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { MobileMenuItem } from "./mobile-menu-item";
import type { Menu } from "@/models/menu-models";

type MenuItem = Extract<Menu, { type: "menu" }>;

const leaf: MenuItem = {
  type: "menu",
  id: "dash",
  name: "Dashboard",
  path: "/app/dashboard",
  icon: Home,
  badge: "beta",
};

const parent: MenuItem = {
  type: "menu",
  id: "idp",
  name: "Identity",
  path: "/app/idp",
  icon: Home,
  children: [
    { type: "menu", id: "roles", name: "Roles", path: "/app/idp/roles" },
    { type: "menu", id: "off", name: "Disabled", path: "/app/idp/off", disabled: true },
  ],
};

const renderAt = (ui: React.ReactElement, path = "/") =>
  render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

describe("MobileMenuItem", () => {
  it("renders a leaf link with a badge and fires onClick when tapped", () => {
    const onClick = vi.fn();
    renderAt(<MobileMenuItem menu={leaf} onClick={onClick} />);
    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("beta")).toBeTruthy();
    fireEvent.click(screen.getByRole("link"));
    expect(onClick).toHaveBeenCalled();
  });

  it("marks the leaf active when the path matches", () => {
    renderAt(<MobileMenuItem menu={leaf} />, "/app/dashboard");
    const container = screen.getByText("Dashboard").closest("div.flex");
    expect(container?.className).toContain("text-primary");
  });

  it("opens a sheet with the enabled children for a parent item", () => {
    const onClick = vi.fn();
    renderAt(<MobileMenuItem menu={parent} onClick={onClick} />);
    fireEvent.click(screen.getByText("Identity"));
    // Sheet content reveals the enabled child and hides the disabled one.
    expect(screen.getByText("Roles")).toBeTruthy();
    expect(screen.queryByText("Disabled")).toBeNull();

    fireEvent.click(screen.getByText("Roles"));
    expect(onClick).toHaveBeenCalled();
  });
});
