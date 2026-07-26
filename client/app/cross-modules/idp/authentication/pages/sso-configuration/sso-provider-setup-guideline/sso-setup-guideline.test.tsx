import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SSOSetupGuideLine } from "./sso-setup-guideline";

const steps = [
  { id: "1", description: <span>Register the app</span> },
  { id: "2", description: <span>Copy the client id</span> },
  { id: "3", description: <span>Finish</span> },
];

describe("SSOSetupGuideLine", () => {
  it("shows the first step with the previous button disabled", () => {
    render(<SSOSetupGuideLine steps={steps} />);
    expect(screen.getByText("Register the app")).toBeTruthy();
    const [prev] = screen.getAllByRole("button");
    expect((prev as HTMLButtonElement).disabled).toBe(true);
  });

  it("navigates forward and backward and disables next at the end", async () => {
    const user = userEvent.setup();
    render(<SSOSetupGuideLine steps={steps} />);
    const [prev, next] = screen.getAllByRole("button");
    await user.click(next);
    expect(screen.getByText("Copy the client id")).toBeTruthy();
    await user.click(next);
    expect(screen.getByText("Finish")).toBeTruthy();
    expect((screen.getAllByRole("button")[1] as HTMLButtonElement).disabled).toBe(true);
    await user.click(prev);
    expect(screen.getByText("Copy the client id")).toBeTruthy();
  });

  it("caps progress at 100 for a single step", () => {
    render(<SSOSetupGuideLine steps={[{ id: "only", description: <span>Only</span> }]} />);
    expect(screen.getByText("Only")).toBeTruthy();
  });
});
