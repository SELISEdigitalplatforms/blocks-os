import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFilteredMenus } from "./use-filtered-menus";
import type { Menu } from "@/models/menu-models";

const wrapperFor = (path: string) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  };

const menu = (id: string, extra: Partial<Menu> = {}): Menu =>
  ({ type: "menu", id, name: id, path: `/${id}`, ...extra }) as Menu;

const sep = (id: string): Menu => ({ type: "separator", id });

describe("useFilteredMenus", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("hides project-only menus when not on a /project route", () => {
    const menus: Menu[] = [menu("environments"), menu("overview-project")];
    const { result } = renderHook(() => useFilteredMenus(menus), {
      wrapper: wrapperFor("/dashboard"),
    });
    const ids = result.current.map((m) => m.id);
    expect(ids).not.toContain("environments");
    expect(ids).toContain("overview-project");
  });

  it("hides non-project menus when on a /project route", () => {
    const menus: Menu[] = [menu("environments"), menu("service-identity__mfa")];
    const { result } = renderHook(() => useFilteredMenus(menus), {
      wrapper: wrapperFor("/project/123"),
    });
    const ids = result.current.map((m) => m.id);
    expect(ids).toContain("environments");
    expect(ids).not.toContain("service-identity__mfa");
  });

  it("removes disabled menus", () => {
    const menus: Menu[] = [menu("people", { disabled: true } as Partial<Menu>)];
    const { result } = renderHook(() => useFilteredMenus(menus), {
      wrapper: wrapperFor("/project/1"),
    });
    expect(result.current).toHaveLength(0);
  });

  it("honors the BLOCKS_BLOCKED_MENU env list", () => {
    vi.stubEnv("BLOCKS_BLOCKED_MENU", JSON.stringify(["repositories"]));
    const menus: Menu[] = [menu("repositories"), menu("settings")];
    const { result } = renderHook(() => useFilteredMenus(menus), {
      wrapper: wrapperFor("/project/1"),
    });
    const ids = result.current.map((m) => m.id);
    expect(ids).not.toContain("repositories");
    expect(ids).toContain("settings");
  });

  it("drops separators that are adjacent to other separators", () => {
    const menus: Menu[] = [
      menu("environments"),
      sep("separator-a"),
      sep("separator-b"),
      menu("people"),
    ];
    const { result } = renderHook(() => useFilteredMenus(menus), {
      wrapper: wrapperFor("/project/1"),
    });
    // Two consecutive separators collapse; only a single valid one survives.
    const separators = result.current.filter((m) => m.type === "separator");
    expect(separators.length).toBeLessThanOrEqual(1);
  });

  it("does not crash when BLOCKS_BLOCKED_MENU is invalid JSON", () => {
    vi.stubEnv("BLOCKS_BLOCKED_MENU", "{not json");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const menus: Menu[] = [menu("settings")];
    const { result } = renderHook(() => useFilteredMenus(menus), {
      wrapper: wrapperFor("/project/1"),
    });
    expect(result.current.map((m) => m.id)).toContain("settings");
    errorSpy.mockRestore();
  });
});
