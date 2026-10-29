import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

// The tooltip kit re-exports genesis-os, whose inlined source drags the real http client --
// and with it a server-side Rollbar that cannot start under jsdom -- into the module graph.
// The stand-in renders the tip inline so the blurb each tier carries stays assertable.
vi.mock("@/components/ui-kits/tooltip/tooltip", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return {
    TooltipProvider: Passthrough,
    Tooltip: Passthrough,
    TooltipTrigger: Passthrough,
    TooltipContent: ({ children }: { children?: React.ReactNode }) => (
      <span data-testid="tier-tip">{children}</span>
    ),
  };
});

import { StorageTierSwitcher } from "./storage-tier-switcher";

describe("StorageTierSwitcher", () => {
  it("offers every storage tier the data can sit in", () => {
    render(<StorageTierSwitcher value="hot" onChange={vi.fn()} />);

    expect(screen.getByRole("tab", { name: /hot/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /cold/i })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /archive/i })).toBeTruthy();
  });

  /** The cards spelled the blurbs out; here they are what the reader gets on hover. */
  it("carries what each tier holds as its tooltip", () => {
    render(<StorageTierSwitcher value="hot" onChange={vi.fn()} />);

    const tips = screen.getAllByTestId("tier-tip").map((tip) => tip.textContent);
    expect(tips).toEqual([
      "Live and recent data for active debugging.",
      "Longer-term stored data for later investigation.",
      "Deep history retained for audit and export use cases.",
    ]);
  });

  it("prefers the page's own wording for a tier over the generic one", () => {
    render(
      <StorageTierSwitcher
        value="hot"
        onChange={vi.fn()}
        descriptions={{ hot: "Live and recent logs for active debugging." }}
      />,
    );

    expect(screen.getAllByTestId("tier-tip")[0].textContent).toBe(
      "Live and recent logs for active debugging.",
    );
  });

  it("marks the tier being read", () => {
    render(<StorageTierSwitcher value="cold" onChange={vi.fn()} />);

    expect(screen.getByRole("tab", { name: /cold/i }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: /hot/i }).getAttribute("aria-selected")).toBe("false");
  });

  /**
   * The tooltip trigger writes its own data-state onto the tab button, so the kit's
   * data-[state=active] classes never match and the selected tier has to be lit by hand --
   * without which all three tiers look identical.
   */
  it("lights the tier being read, and only that one", () => {
    render(<StorageTierSwitcher value="cold" onChange={vi.fn()} />);

    // The token itself, not a substring: the kit's own data-[state=active]:bg-background sits
    // on every trigger and would match either way.
    const lit = (name: RegExp) =>
      screen.getByRole("tab", { name }).classList.contains("bg-background");
    expect(lit(/cold/i)).toBe(true);
    expect(lit(/hot/i)).toBe(false);
    expect(lit(/archive/i)).toBe(false);
  });

  it("reports the tier the reader picks", async () => {
    const onChange = vi.fn();
    render(<StorageTierSwitcher value="hot" onChange={onChange} />);

    await userEvent.click(screen.getByRole("tab", { name: /archive/i }));

    expect(onChange).toHaveBeenCalledWith("archive");
  });

  /** Re-picking would reset the page and paging of a list the reader is already reading. */
  it("does not re-report the tier already being read", async () => {
    const onChange = vi.fn();
    render(<StorageTierSwitcher value="hot" onChange={onChange} />);

    await userEvent.click(screen.getByRole("tab", { name: /hot/i }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
