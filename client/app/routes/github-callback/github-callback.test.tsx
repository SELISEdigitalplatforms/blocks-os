import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWrapper } from "@/test-utils/test-providers/query-client";

vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const h = vi.hoisted(() => ({ verifyAuthorization: vi.fn() }));
vi.mock("@/cross-modules/devops/services/github-info.service", () => ({
  githubInfoService: { verifyAuthorization: h.verifyAuthorization },
}));
const verifyAuthorization = h.verifyAuthorization;

import CallbackPage from "./github-callback";

const renderAt = (search: string) =>
  render(
    <MemoryRouter initialEntries={[`/callback${search}`]}>
      <CallbackPage />
    </MemoryRouter>,
    { wrapper: createWrapper() },
  );

describe("CallbackPage (devops github callback)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.close = vi.fn();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("shows the loading spinner while verifying the authorization code", () => {
    verifyAuthorization.mockReturnValue(new Promise(() => {}));
    renderAt("?code=gh-code&state=st");
    expect(screen.getByAltText("Loading")).toBeTruthy();
  });

  it("verifies the code with the stored project key and cleans up on success", async () => {
    localStorage.setItem("github_auth_project_key", "proj-1");
    localStorage.setItem("github_auth_state", "state-1");
    localStorage.setItem("github_auth_destination", "/dest");
    verifyAuthorization.mockResolvedValue("ok");

    renderAt("?code=gh-code&state=st");

    await waitFor(() => expect(verifyAuthorization).toHaveBeenCalledWith("gh-code", "proj-1"));
    await waitFor(() => expect(window.close).toHaveBeenCalled());

    expect(localStorage.getItem("isReload")).not.toBeNull();
    expect(localStorage.getItem("github_auth_state")).toBeNull();
    expect(localStorage.getItem("github_auth_project_key")).toBeNull();
    expect(localStorage.getItem("github_auth_destination")).toBeNull();
  });

  it("does not run the verification when no code is present", () => {
    const { container } = renderAt("");
    expect(verifyAuthorization).not.toHaveBeenCalled();
    expect(container).toBeTruthy();
    expect(screen.queryByAltText("Loading")).toBeNull();
  });
});
