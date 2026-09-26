import { IConnectTemplate } from "@/cross-modules/connect/models/connect.model";

/**
 * Automatic Connect setup for template projects.
 *
 * Runs in the console for now: the first time an environment of a template project is opened
 * after provisioning, and only while the environment has no setup record. It goes through the
 * same runner as the manual Setup button, so it reuses IAM's endpoints and everything left by an
 * interrupted run.
 *
 * To move it into the provisioning worker, have the worker read the group's project type and
 * write the setup; the console then always finds a record and never runs. Removing
 * `ConnectAutoSetup` from the router finishes the move.
 */

/** The template a template project is set up with. */
export const DEFAULT_CONNECT_TEMPLATE_KEY = "localization";

/** The default template when it is active, otherwise the only active one, otherwise none. */
export const pickAutoSetupTemplate = (
  templates: IConnectTemplate[],
): IConnectTemplate | undefined =>
  templates.find((template) => template.key === DEFAULT_CONNECT_TEMPLATE_KEY) ??
  (templates.length === 1 ? templates[0] : undefined);

// Module-level, not component state, so a remount while navigating between pages of the same
// environment cannot start a second run. Reloading the page allows one more attempt, which is
// how a failed automatic setup is retried; the Connect page also offers manual setup.
const attemptedTenants = new Set<string>();

/** Records the attempt and returns true the first time it is asked for a tenant. */
export const claimAutoSetupAttempt = (tenantId: string): boolean => {
  if (!tenantId || attemptedTenants.has(tenantId)) return false;
  attemptedTenants.add(tenantId);
  return true;
};

/** Test-only: forget every attempt. */
export const resetAutoSetupAttempts = () => attemptedTenants.clear();
