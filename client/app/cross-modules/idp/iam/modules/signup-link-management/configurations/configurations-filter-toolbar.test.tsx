import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  queryParams: { page: 1, pageSize: 10, search: "abc", includeInactive: false },
  setQueryParams: vi.fn(),
}));

vi.mock("nuqs", () => ({
  parseAsInteger: { withDefault: () => ({}) },
  parseAsString: { withDefault: () => ({}) },
  parseAsBoolean: { withDefault: () => ({}) },
  useQueryStates: () => [h.queryParams, h.setQueryParams],
}));

vi.mock("@/components/filter-toolbar", () => ({
  FilterToolbar: ({
    onChange,
    onReset,
  }: {
    onChange: (k: string, v: string) => void;
    onReset: () => void;
  }) => (
    <div>
      <button type="button" onClick={() => onChange("search", "new")}>
        Search change
      </button>
      <button type="button" onClick={onReset}>
        Reset
      </button>
    </div>
  ),
}));

vi.mock("@/components/ui-kits/switch/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    id,
  }: {
    checked: boolean;
    onCheckedChange: (v: boolean) => void;
    id: string;
  }) => (
    <button type="button" id={id} onClick={() => onCheckedChange(!checked)}>
      switch-{String(checked)}
    </button>
  ),
}));

vi.mock("@/components/ui-kits/label/label", () => ({
  Label: ({ children }: { children: ReactNode }) => <label>{children}</label>,
}));

import { ConfigurationsFilterToolbar } from "./configurations-filter-toolbar";

describe("ConfigurationsFilterToolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.queryParams = { page: 1, pageSize: 10, search: "abc", includeInactive: false };
  });

  it("resets page when search changes and clears on reset", async () => {
    const user = userEvent.setup();
    render(<ConfigurationsFilterToolbar />);
    await user.click(screen.getByRole("button", { name: "Search change" }));
    expect(h.setQueryParams).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(h.setQueryParams).toHaveBeenCalledWith(null);
  });

  it("toggles show archived", async () => {
    const user = userEvent.setup();
    render(<ConfigurationsFilterToolbar />);
    await user.click(screen.getByRole("button", { name: "switch-false" }));
    expect(h.setQueryParams).toHaveBeenCalled();
  });
});
