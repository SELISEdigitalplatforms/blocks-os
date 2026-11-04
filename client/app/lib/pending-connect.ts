/** localStorage hand-off between the /connect entry step and post-login redirects. */
const STORAGE_KEY = "blocks:pending-integration-request";

export type PendingConnectRequest = {
  requestId: string;
  expiresAt: string;
  /**
   * The CMS's own callback coordinates, kept only so an expired request can still send the
   * browser back with `error=expired`. Neither value is secret; the PKCE verifier never
   * leaves the CMS.
   */
  redirectUri?: string;
  state?: string;
};

const safeStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    // Private mode or storage disabled: the flow still works, it just cannot survive
    // the login redirect.
    return null;
  }
};

export const savePendingConnectRequest = (request: PendingConnectRequest): void => {
  safeStorage()?.setItem(STORAGE_KEY, JSON.stringify(request));
};

/** The pending request, or null when absent, unreadable or already expired. */
export const readPendingConnectRequest = (): PendingConnectRequest | null => {
  try {
    const raw = safeStorage()?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingConnectRequest;
    if (!parsed?.requestId || !parsed?.expiresAt) return null;
    if (new Date(parsed.expiresAt) <= new Date()) {
      clearPendingConnectRequest();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearPendingConnectRequest = (): void => {
  try {
    safeStorage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do: unreadable storage cannot hold a pending request either.
  }
};
