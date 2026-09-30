import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectEnvironmentCheckboxes } from "./project-environment-checkboxes";

describe("ProjectEnvironmentCheckboxes compact variant", () => {
  it("shows environment and branch chips without the wizard descriptions", () => {
    const onToggle = vi.fn();
    render(<ProjectEnvironmentCheckboxes variant="compact" selected={["dev"]} onToggle={onToggle} />);

    const development = screen.getByRole("button", { name: "Development, branch dev" });
    const production = screen.getByRole("button", { name: "Production, branch main" });
    expect(development.getAttribute("aria-pressed")).toBe("true");
    expect(production.getAttribute("aria-pressed")).toBe("false");
    expect(screen.queryByText(/day-to-day development/)).toBeNull();
    expect(screen.queryByText(/Please ensure that the branch name/)).toBeNull();

    fireEvent.click(production);
    expect(onToggle).toHaveBeenCalledWith("prod", true);
  });
});
