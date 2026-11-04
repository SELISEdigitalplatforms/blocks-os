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

describe("ProjectEnvironmentCheckboxes default variant", () => {
  it("toggles an environment when its name is clicked", () => {
    const onToggle = vi.fn();
    render(<ProjectEnvironmentCheckboxes selected={[]} onToggle={onToggle} />);

    fireEvent.click(screen.getByText("Development", { exact: true }));
    expect(onToggle).toHaveBeenCalledWith("dev", true);
  });
});
