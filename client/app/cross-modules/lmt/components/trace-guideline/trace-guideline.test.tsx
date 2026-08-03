import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TraceGuideLine } from "./trace-guideline";

const steps = [
  { id: "1", description: <span>Step one</span> },
  { id: "2", description: <span>Step two</span> },
  { id: "3", description: <span>Step three</span> },
];

describe("TraceGuideLine", () => {
  it("shows the first step with the previous button disabled", () => {
    render(<TraceGuideLine steps={steps} />);
    expect(screen.getByText("Step one")).toBeTruthy();
    const [prev, next] = screen.getAllByRole("button");
    expect((prev as HTMLButtonElement).disabled).toBe(true);
    expect((next as HTMLButtonElement).disabled).toBe(false);
  });

  it("navigates forward and backward through the steps", async () => {
    const user = userEvent.setup();
    render(<TraceGuideLine steps={steps} />);
    const [prev, next] = screen.getAllByRole("button");
    await user.click(next);
    expect(screen.getByText("Step two")).toBeTruthy();
    await user.click(next);
    expect(screen.getByText("Step three")).toBeTruthy();
    // At the last step the next button is disabled.
    expect((screen.getAllByRole("button")[1] as HTMLButtonElement).disabled).toBe(true);
    await user.click(prev);
    expect(screen.getByText("Step two")).toBeTruthy();
  });

  it("caps progress at 100 for a single step", () => {
    render(<TraceGuideLine steps={[{ id: "only", description: <span>Only</span> }]} />);
    expect(screen.getByText("Only")).toBeTruthy();
  });
});
