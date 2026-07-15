import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

// jsdom does not implement canvas 2d; the component bails out when ctx is null.
HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;

vi.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ theme: "system", setTheme: vi.fn() }),
}));

import { BlocksLoginPage } from "./index";

describe("BlocksLoginPage", () => {
  it("renders the active product hero and the login button", () => {
    render(<BlocksLoginPage name="blocks-os" onLogin={vi.fn()} />);
    expect(
      screen.getByText("Enterprise platform for secure, scalable applications"),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log in to your account" })).toBeTruthy();
  });

  it("calls onLogin when the login button is clicked", async () => {
    const onLogin = vi.fn();
    const user = userEvent.setup();
    render(<BlocksLoginPage name="blocks-os" onLogin={onLogin} />);

    await user.click(screen.getByRole("button", { name: "Log in to your account" }));
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it("shows a redirecting, disabled button while loading", () => {
    render(<BlocksLoginPage name="blocks-os" onLogin={vi.fn()} isLoading />);
    const btn = screen.getByRole("button", { name: "Redirecting…" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("renders the docs nav link pointing at the provided docs URL", () => {
    render(
      <BlocksLoginPage name="blocks-os" onLogin={vi.fn()} docsUrl="https://docs.example.com/" />,
    );
    const docsLink = screen.getByRole("link", { name: "Docs" }) as HTMLAnchorElement;
    expect(docsLink.getAttribute("href")).toBe("https://docs.example.com/");
  });

  it("renders carousel cards from provided carousel items", () => {
    render(
      <BlocksLoginPage
        name="blocks-os"
        onLogin={vi.fn()}
        carouselItems={[
          {
            badge: "AI",
            title: "Blocks Agent Platform",
            description: "Intelligent agents everywhere.",
            features: ["RAG", "MCP"],
            url: "https://agents.example.com",
            cta: "Visit Agent Platform",
          },
        ]}
      />,
    );
    expect(screen.getByText("1 services")).toBeTruthy();
    // "Blocks " prefix is stripped for the card name; duplicated for the marquee.
    expect(screen.getAllByText("Agent Platform").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Intelligent agents everywhere.").length).toBeGreaterThan(0);
  });
});
