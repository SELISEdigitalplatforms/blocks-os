import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/logo", () => ({ Logo: () => <div data-testid="logo" /> }));

const h = vi.hoisted(() => ({ env: {} as Record<string, string> }));
vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: (key: string) => h.env[key] ?? "",
}));

import { PeopleInvitationResult } from "./people-invitation-result";

const renderResult = (props: Parameters<typeof PeopleInvitationResult>[0]) =>
  render(
    <MemoryRouter>
      <PeopleInvitationResult {...props} />
    </MemoryRouter>,
  );

beforeEach(() => {
  h.env = {};
});

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

  it("falls back to the OS activation page when IAM is not configured", () => {
    renderResult({ success: "1", error: "", old: "0", code: "abc123" });
    expect(screen.getByText("Invitation Accepted!")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Activate" }).getAttribute("href") || "";
    expect(link).toContain("/activate?");
    expect(link).toContain("code=abc123");
    expect(link).toContain("lang=en-US");
  });

  it("sends new accounts to IAM's OIDC activation page", () => {
    h.env = {
      BLOCKS_IAM_BASE_URL: "https://iam.example.com/",
      BLOCKS_X_BLOCKS_KEY: "tenant-1",
    };
    renderResult({ success: "1", error: "", old: "0", code: "abc123" });
    const link = screen.getByRole("link", { name: "Activate" }).getAttribute("href") || "";
    expect(link).toContain("https://iam.example.com/oidc/activate/tenant-1?");
    expect(link).toContain("code=abc123");
  });

  it("carries the OS client and redirect uri so IAM can hand the user back", () => {
    h.env = {
      BLOCKS_IAM_BASE_URL: "https://iam.example.com",
      BLOCKS_X_BLOCKS_KEY: "tenant-1",
      BLOCKS_OIDC_CLIENT_ID: "os-client",
    };
    renderResult({ success: "1", error: "", old: "0", code: "abc123" });
    const link = screen.getByRole("link", { name: "Activate" }).getAttribute("href") || "";
    expect(link).toContain("clientId=os-client");
    expect(link).toContain(
      `redirect_uri=${encodeURIComponent(`${window.location.origin}/login/callback`)}`,
    );
  });

  it("sends existing users to the console", () => {
    renderResult({ success: "1", error: "", old: "1", code: "" });
    expect(screen.getByText("Invitation Accepted!")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go to Console" }).getAttribute("href")).toContain(
      "/login",
    );
  });
});
