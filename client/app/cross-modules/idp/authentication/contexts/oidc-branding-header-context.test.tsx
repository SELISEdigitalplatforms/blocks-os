import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  OidcBrandingHeaderProvider,
  useOidcBrandingHeader,
  useOidcBrandingHeaderOptional,
} from "./oidc-branding-header-context";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <OidcBrandingHeaderProvider>{children}</OidcBrandingHeaderProvider>
);

describe("OidcBrandingHeaderContext", () => {
  it("stores and exposes header actions through the provider", () => {
    const { result } = renderHook(() => useOidcBrandingHeader(), { wrapper });
    expect(result.current.actions).toBeNull();
    const actions = {
      onSave: vi.fn(),
      onUndo: vi.fn(),
      isBusy: false,
      isDirty: true,
      isValid: true,
    };
    act(() => result.current.setActions(actions));
    expect(result.current.actions).toBe(actions);
    act(() => result.current.setActions(null));
    expect(result.current.actions).toBeNull();
  });

  it("throws when used outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const Consumer = () => {
      useOidcBrandingHeader();
      return null;
    };
    expect(() => render(<Consumer />)).toThrow(
      "useOidcBrandingHeader must be used within OidcBrandingHeaderProvider",
    );
    spy.mockRestore();
  });

  it("returns null from the optional hook outside a provider", () => {
    const { result } = renderHook(() => useOidcBrandingHeaderOptional());
    expect(result.current).toBeNull();
  });

  it("renders provider children", () => {
    render(
      <OidcBrandingHeaderProvider>
        <span>child</span>
      </OidcBrandingHeaderProvider>,
    );
    expect(screen.getByText("child")).toBeTruthy();
  });
});
