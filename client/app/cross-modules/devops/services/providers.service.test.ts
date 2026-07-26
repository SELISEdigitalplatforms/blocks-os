import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authenticateWithGithub,
  verifyOAuthState,
  authenticateWithGitlab,
  authenticateWithBitbucket,
  authenticateWithAzure,
  authenticateWithAws,
} from "./providers.service";

type BlocksWindow = Window & { __BLOCKS_ENV__?: Record<string, string | undefined> };

describe("providers.service", () => {
  beforeEach(() => {
    localStorage.clear();
    (window as BlocksWindow).__BLOCKS_ENV__ = {
      BLOCKS_GITHUB_SSO_CLIENT_ID: "client-123",
    };
  });

  afterEach(() => {
    localStorage.clear();
    delete (window as BlocksWindow).__BLOCKS_ENV__;
    vi.restoreAllMocks();
  });

  describe("authenticateWithGithub", () => {
    it("opens the GitHub OAuth url and stores auth state", () => {
      const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
      localStorage.setItem("destination", "/projects");

      authenticateWithGithub(undefined, "pk-1");

      expect(openSpy).toHaveBeenCalledTimes(1);
      const url = openSpy.mock.calls[0][0] as string;
      expect(url).toContain("https://github.com/login/oauth/authorize");
      expect(url).toContain("client_id=client-123");

      const storedState = localStorage.getItem("github_auth_state");
      expect(storedState).toBeTruthy();
      expect(url).toContain(`state=${storedState}`);
      expect(localStorage.getItem("github_auth_destination")).toBe("/projects");
      expect(localStorage.getItem("github_auth_project_key")).toBe("pk-1");
    });

    it("defaults the destination to '/' and omits the project key when not provided", () => {
      vi.spyOn(window, "open").mockReturnValue(null);
      authenticateWithGithub();
      expect(localStorage.getItem("github_auth_destination")).toBe("/");
      expect(localStorage.getItem("github_auth_project_key")).toBeNull();
    });
  });

  describe("verifyOAuthState", () => {
    it("returns true when the received state matches the stored state", () => {
      localStorage.setItem("github_auth_state", "abc");
      expect(verifyOAuthState("abc")).toBe(true);
    });
    it("returns false when the state does not match", () => {
      localStorage.setItem("github_auth_state", "abc");
      expect(verifyOAuthState("xyz")).toBe(false);
    });
    it("returns false when a state is stored but null is received", () => {
      localStorage.setItem("github_auth_state", "abc");
      expect(verifyOAuthState(null)).toBe(false);
    });
  });

  describe("unimplemented providers", () => {
    it("do not throw", () => {
      const logSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => authenticateWithGitlab()).not.toThrow();
      expect(() => authenticateWithBitbucket()).not.toThrow();
      expect(() => authenticateWithAzure()).not.toThrow();
      expect(() => authenticateWithAws()).not.toThrow();
      expect(logSpy).toHaveBeenCalled();
    });
  });
});
