import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import React from "react";
import { describe, expect, it } from "vitest";
import {
  useInvitationConfirmCode,
  useInvitationResultSearchParams,
  buildInvitationResultPath,
} from "./use-invitation-search-params";

const wrapperFor = (path: string) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  };

describe("use-invitation-search-params", () => {
  describe("useInvitationConfirmCode", () => {
    it("extracts and trims the code, marking it valid", () => {
      const { result } = renderHook(() => useInvitationConfirmCode(), {
        wrapper: wrapperFor("/invitation?code=%20abc%20"),
      });
      expect(result.current).toEqual({ code: "abc", isValid: true });
    });

    it("marks a missing code invalid", () => {
      const { result } = renderHook(() => useInvitationConfirmCode(), {
        wrapper: wrapperFor("/invitation"),
      });
      expect(result.current).toEqual({ code: "", isValid: false });
    });
  });

  describe("useInvitationResultSearchParams", () => {
    it("reads all result params", () => {
      const { result } = renderHook(() => useInvitationResultSearchParams(), {
        wrapper: wrapperFor("/invitation/result?success=true&old=1&error=&code=k"),
      });
      expect(result.current).toEqual({
        success: "true",
        old: "1",
        error: "",
        code: "k",
      });
    });
  });

  describe("buildInvitationResultPath", () => {
    it("builds a query string from params", () => {
      expect(buildInvitationResultPath({ success: "true", code: "k" })).toBe(
        "/invitation/result?success=true&code=k",
      );
    });
  });
});
