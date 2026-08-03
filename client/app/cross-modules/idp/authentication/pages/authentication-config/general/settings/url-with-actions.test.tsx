import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// blocks-kit's theme store reads matchMedia at import time, which jsdom does not provide.
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

import { UrlWithActions } from "./url-with-actions";

describe("UrlWithActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Take the secure navigator.clipboard path (userEvent.setup provides the stub).
    Object.defineProperty(window, "isSecureContext", {
      value: true,
      configurable: true,
    });
  });

  it("renders an empty-state message when the url is blank", () => {
    render(<UrlWithActions url="   " />);
    expect(screen.getByText("No certificate configured")).toBeTruthy();
  });

  it("renders the certificate link and action buttons", () => {
    render(<UrlWithActions url="https://certs.example.com/public.pem" />);

    const link = screen.getByRole("link", {
      name: "Public Certificate",
    }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("https://certs.example.com/public.pem");
    expect(screen.getByLabelText("Copy certificate URL")).toBeTruthy();
    expect(screen.getByLabelText("Download certificate")).toBeTruthy();
  });

  it("copies the url to the clipboard and flips the button state", async () => {
    const user = userEvent.setup();
    render(<UrlWithActions url="https://certs.example.com/public.pem" />);

    // Before copying, the button advertises the copy affordance.
    expect(screen.getByLabelText("Copy certificate URL")).toBeTruthy();

    await user.click(screen.getByLabelText("Copy certificate URL"));

    // A successful copy flips the button into its "Copied" confirmation state.
    await waitFor(() => {
      expect(screen.getByLabelText("Copied")).toBeTruthy();
    });
  });

  it("falls back to execCommand when not in a secure context", async () => {
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
    const execCommand = vi.fn();
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
    const user = userEvent.setup();
    render(<UrlWithActions url="https://certs.example.com/public.pem" />);
    await user.click(screen.getByLabelText("Copy certificate URL"));
    await waitFor(() => expect(execCommand).toHaveBeenCalledWith("copy"));
  });

  it("downloads the certificate through a temporary blob url", async () => {
    const blob = new Blob(["data"]);
    const fetchMock = vi.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) });
    vi.stubGlobal("fetch", fetchMock);
    const createObjectURL = vi.fn().mockReturnValue("blob:1");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<UrlWithActions url="https://certs.example.com/public.pem" />);
    await user.click(screen.getByLabelText("Download certificate"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("https://certs.example.com/public.pem"),
    );
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:1");
    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("logs an error when the download request fails", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();
    render(<UrlWithActions url="https://certs.example.com/public.pem" />);
    await user.click(screen.getByLabelText("Download certificate"));
    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    errorSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
