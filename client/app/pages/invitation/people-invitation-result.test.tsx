import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/logo", () => ({ Logo: () => <div data-testid="logo" /> }));

import { PeopleInvitationResult } from "./people-invitation-result";

const renderResult = (props: Parameters<typeof PeopleInvitationResult>[0]) =>
  render(
    <MemoryRouter>
      <PeopleInvitationResult {...props} />
    </MemoryRouter>,
  );

describe("PeopleInvitationResult", () => {
  it("shows an expired message when the invitation failed with expiry", () => {
    renderResult({ success: "0", error: "expired", old: "1", code: "" });
    expect(screen.getByText("Failed")).toBeTruthy();
    expect(screen.getByText("The invitation link has expired.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go back" }).getAttribute("href")).toContain("/login");
  });

  it("shows a generic failure message for other errors", () => {
    renderResult({ success: "0", error: "boom", old: "1", code: "" });
    expect(screen.getByText("An error occurred during invitation confirmation.")).toBeTruthy();
  });

  it("prompts activation for a new account", () => {
    renderResult({ success: "1", error: "", old: "0", code: "abc123" });
    expect(screen.getByText("Invitation Accepted!")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Activate" }).getAttribute("href") || "";
    expect(link).toContain("/activate?");
    expect(link).toContain("code=abc123");
    expect(link).toContain("lang=en-US");
  });

  it("sends existing users to the console", () => {
    renderResult({ success: "1", error: "", old: "1", code: "" });
    expect(screen.getByText("Invitation Accepted!")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to Console" }).getAttribute("href")).toContain(
      "/login",
    );
  });
});
