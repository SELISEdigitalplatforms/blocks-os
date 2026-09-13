import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ isMobile: vi.fn() }));

vi.mock("@seliseblocks/genesis-os/hooks", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useIsMobile: () => h.isMobile() };
});

import { StorageTierCards } from "./storage-tier-cards";

describe("StorageTierCards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isMobile.mockReturnValue(false);
  });

  it("offers every storage tier the data can sit in", () => {
    render(<StorageTierCards value="hot" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /hot/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /cold/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /archive/i })).toBeTruthy();
  });

  it("says what each tier holds, so the choice is not a guess", () => {
    render(<StorageTierCards value="hot" onChange={vi.fn()} />);

    expect(screen.getByText(/live and recent/i)).toBeTruthy();
    expect(screen.getByText(/longer-term/i)).toBeTruthy();
    expect(screen.getByText(/deep history/i)).toBeTruthy();
  });

  it("marks the tier being read", () => {
    render(<StorageTierCards value="cold" onChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: /cold/i }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /hot/i }).getAttribute("aria-pressed")).toBe("false");
  });

  it("reports the tier the reader picks", async () => {
    const onChange = vi.fn();
    render(<StorageTierCards value="hot" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /archive/i }));

    expect(onChange).toHaveBeenCalledWith("archive");
  });

  it("does not re-report the tier already being read", async () => {
    const onChange = vi.fn();
    render(<StorageTierCards value="hot" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /hot/i }));

    expect(onChange).not.toHaveBeenCalled();
  });

  /** Three side-by-side cards do not fit a phone, so the same choice collapses to one control. */
  it("collapses to a single control on a phone", () => {
    h.isMobile.mockReturnValue(true);
    render(<StorageTierCards value="cold" onChange={vi.fn()} />);

    expect(screen.getByRole("combobox")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /deep history/i })).toBeNull();
  });
});
