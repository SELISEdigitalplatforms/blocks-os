import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import { describe, expect, it } from "vitest";
import useRoutePathSegments from "./use-path-segments";

const wrapperFor = (path: string) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  };

describe("useRoutePathSegments", () => {
  it("returns an empty list for the root path", () => {
    const { result } = renderHook(() => useRoutePathSegments(), {
      wrapper: wrapperFor("/"),
    });
    expect(result.current).toEqual([]);
  });

  it("builds cumulative hrefs and title-cased labels", () => {
    const { result } = renderHook(() => useRoutePathSegments(), {
      wrapper: wrapperFor("/dashboard/api-settings"),
    });
    expect(result.current).toEqual([
      { href: "/dashboard", label: "Dashboard" },
      { href: "/dashboard/api-settings", label: "Api Settings" },
    ]);
  });

  it("ignores empty segments from trailing slashes", () => {
    const { result } = renderHook(() => useRoutePathSegments(), {
      wrapper: wrapperFor("/people/"),
    });
    expect(result.current).toEqual([{ href: "/people", label: "People" }]);
  });
});
