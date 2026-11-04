import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import {
  toNotificationView,
  useNotificationNavigation,
  useNotificationView,
} from "./use-notification-navigation";

vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (path: string) => `/app/p1/${path}`,
}));

const BASE = "/app/p1/secret-management/notification";

const setup = (url: string) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ nav: useNotificationNavigation(), location: useLocation() }), {
    wrapper,
  });
};

describe("notification navigation", () => {
  it("maps a path to a page", () => {
    expect(toNotificationView(undefined)).toEqual({ kind: "list" });
    expect(toNotificationView("new")).toEqual({ kind: "new" });
    expect(toNotificationView("push")).toEqual({ kind: "push" });
    expect(toNotificationView("push", "devices")).toEqual({ kind: "devices" });
    expect(toNotificationView("abc")).toEqual({ kind: "edit", id: "abc" });
  });

  it("reads the page from the route params", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={["/n/push/devices"]}>
        <Routes>
          <Route path="/n/:notificationId/:notificationSub" element={children} />
        </Routes>
      </MemoryRouter>
    );
    const { result } = renderHook(() => useNotificationView(), { wrapper });
    expect(result.current).toEqual({ kind: "devices" });
  });

  it("opens the push pages and keeps the list filters in the query", () => {
    const { result } = setup("/x?q=ana");
    act(() => {
      result.current.nav.openDevices();
    });
    expect(result.current.location.pathname).toBe(`${BASE}/push/devices`);
    expect(result.current.location.search).toBe("?q=ana");
  });

  it("opens the list, the new page and the push settings", () => {
    const { result } = setup("/x");
    act(() => result.current.nav.openList());
    expect(result.current.location.pathname).toBe(BASE);
    act(() => result.current.nav.openNew());
    expect(result.current.location.pathname).toBe(`${BASE}/new`);
    act(() => result.current.nav.openPush());
    expect(result.current.location.pathname).toBe(`${BASE}/push`);
  });

  it("encodes the id of the notification it opens", () => {
    const { result } = setup("/x");
    act(() => {
      result.current.nav.openEdit("a b/c");
    });
    expect(result.current.location.pathname).toBe(`${BASE}/a%20b/c`);
  });

  it("moves an old edit link to the path and keeps other params", () => {
    const { result } = setup("/x?notificationEdit=n1&q=ana");
    act(() => {
      result.current.nav.redirectLegacyLink();
    });
    expect(result.current.location.pathname).toBe(`${BASE}/n1`);
    expect(result.current.location.search).toBe("?q=ana");
  });

  it("moves old add and push links to the new and push pages", () => {
    const add = setup("/x?notificationConfig=true");
    act(() => {
      add.result.current.nav.redirectLegacyLink();
    });
    expect(add.result.current.location.pathname).toBe(`${BASE}/new`);
    expect(add.result.current.location.search).toBe("");

    const push = setup("/x?notificationPush=true");
    act(() => {
      push.result.current.nav.redirectLegacyLink();
    });
    expect(push.result.current.location.pathname).toBe(`${BASE}/push`);
  });

  it("leaves a normal link alone", () => {
    const { result } = setup("/x?q=ana");
    act(() => {
      result.current.nav.redirectLegacyLink();
    });
    expect(result.current.location.pathname).toBe("/x");
  });
});
