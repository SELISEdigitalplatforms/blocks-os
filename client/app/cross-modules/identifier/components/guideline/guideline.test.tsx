import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GuideLine } from "./guideline";

const steps = [
  { id: "1", description: <span>Intro</span> },
  { id: "2", description: <span>Details</span> },
];

describe("GuideLine", () => {
  it("renders the first step and disables the previous button", () => {
    render(<GuideLine steps={steps} />);
    expect(screen.getByText("Intro")).toBeTruthy();
    const [prev] = screen.getAllByRole("button");
    expect((prev as HTMLButtonElement).disabled).toBe(true);
  });

  it("moves to the next step and disables next at the end", async () => {
    const user = userEvent.setup();
    render(<GuideLine steps={steps} />);
    const [, next] = screen.getAllByRole("button");
    await user.click(next);
    expect(screen.getByText("Details")).toBeTruthy();
    expect((screen.getAllByRole("button")[1] as HTMLButtonElement).disabled).toBe(true);
  });

  it("returns full progress for a single step", () => {
    render(<GuideLine steps={[{ id: "only", description: <span>Solo</span> }]} />);
    expect(screen.getByText("Solo")).toBeTruthy();
  });
});
