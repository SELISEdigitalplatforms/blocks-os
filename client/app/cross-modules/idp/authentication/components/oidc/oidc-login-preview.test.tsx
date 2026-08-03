import { render, screen, fireEvent, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OidcLoginPreview } from "./oidc-login-preview";

describe("OidcLoginPreview", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.classList.remove("dark");
  });

  it("renders the login preview scaffolding with the default Blocks logo", () => {
    const { container } = render(<OidcLoginPreview />);

    expect(screen.getByLabelText("Login page preview")).toBeTruthy();
    expect(screen.getByText("Blocks IAM")).toBeTruthy();
    expect(screen.getByText("Work Email")).toBeTruthy();
    expect(screen.getByText("Password")).toBeTruthy();
    expect(screen.getByText("Login")).toBeTruthy();
    expect(screen.getByText("Create an account")).toBeTruthy();
    // Default logo is the inline SVG, no client image present.
    expect(container.querySelector('img[alt="Client logo"]')).toBeNull();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("shows the client logo image when a logo url is provided", () => {
    render(<OidcLoginPreview clientLogoUrl="https://cdn.example.com/logo.png" />);
    const logo = screen.getByAltText("Client logo") as HTMLImageElement;
    expect(logo).toBeTruthy();
    expect(logo.src).toBe("https://cdn.example.com/logo.png");
  });

  it("applies the provided brand color as the --accent css var", () => {
    render(<OidcLoginPreview clientBrandColor="#ff8800" />);
    const root = screen.getByLabelText("Login page preview") as HTMLElement;
    expect(root.style.getPropertyValue("--accent")).toBe("#ff8800");
  });

  it("initialises theme from the document class and defaults to light", () => {
    render(<OidcLoginPreview />);
    const root = screen.getByLabelText("Login page preview") as HTMLElement;
    expect(root.getAttribute("data-theme")).toBe("light");
  });

  it("reads a dark document theme on mount", () => {
    document.documentElement.classList.add("dark");
    render(<OidcLoginPreview />);
    const root = screen.getByLabelText("Login page preview") as HTMLElement;
    expect(root.getAttribute("data-theme")).toBe("dark");
  });

  it("lets the user switch the preview theme with the toggle", () => {
    render(<OidcLoginPreview />);
    const root = screen.getByLabelText("Login page preview") as HTMLElement;

    fireEvent.click(screen.getByRole("tab", { name: "Dark" }));
    expect(root.getAttribute("data-theme")).toBe("dark");

    fireEvent.click(screen.getByRole("tab", { name: "Light" }));
    expect(root.getAttribute("data-theme")).toBe("light");
  });

  it("follows the system theme when Auto is selected and reacts to changes", () => {
    const listeners: Array<() => void> = [];
    let prefersDark = true;
    const addEventListener = vi.fn((_event: string, cb: () => void) => {
      listeners.push(cb);
    });
    const removeEventListener = vi.fn();
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          matches: prefersDark,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener,
          removeEventListener,
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    );

    render(<OidcLoginPreview />);
    const root = screen.getByLabelText("Login page preview") as HTMLElement;

    fireEvent.click(screen.getByRole("tab", { name: "Auto" }));
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(addEventListener).toHaveBeenCalled();

    // Simulate the OS flipping to light and firing the media query change.
    prefersDark = false;
    act(() => {
      listeners.forEach((cb) => cb());
    });
    expect(root.getAttribute("data-theme")).toBe("light");
  });

  it("marks the active theme tab with aria-selected", () => {
    render(<OidcLoginPreview />);
    fireEvent.click(screen.getByRole("tab", { name: "Dark" }));
    expect(screen.getByRole("tab", { name: "Dark" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Light" }).getAttribute("aria-selected")).toBe("false");
  });
});
