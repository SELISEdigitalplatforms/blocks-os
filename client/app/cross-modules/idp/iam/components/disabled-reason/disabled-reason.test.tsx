import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui-kits/tooltip/tooltip", () => import("@/test-utils/__mocks__/tooltip.mock"));

import { DisabledReason } from "./disabled-reason";

describe("DisabledReason", () => {
  it("renders the control untouched when there is no reason", () => {
    render(
      <DisabledReason>
        <button type="button">Edit</button>
      </DisabledReason>,
    );
    expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
    expect(screen.queryByTestId("disabled-reason")).toBeNull();
  });

  it("wraps the control in an explainer that carries the reason as screen-reader text", () => {
    render(
      <DisabledReason reason="You can't manage this user.">
        <button type="button" disabled>
          Edit
        </button>
      </DisabledReason>,
    );
    const wrapper = screen.getByTestId("disabled-reason");
    expect(wrapper.hasAttribute("tabindex")).toBe(false);
    expect(wrapper.querySelector("button")?.disabled).toBe(true);
    expect(wrapper.querySelector(".sr-only")?.textContent).toBe("You can't manage this user.");
  });
});
