import Rollbar from "rollbar";
import { getRuntimeEnv } from "@/lib/runtime-env";

/**
 * Payload keys and header names that must never leave the browser. Rollbar scrubs a default set
 * already; these are the platform-specific ones, and shipping a tenant's key or token to a third
 * party would be the worst kind of telemetry bug.
 */
const SCRUB_FIELDS = [
  "x-blocks-key",
  "X-Blocks-Key",
  "Authorization",
  "authorization",
  "access_token",
  "refresh_token",
  "accessToken",
  "refreshToken",
  "password",
  "clientSecret",
  "client_secret",
  "secretValue",
];

/**
 * Noise that reaches window.onerror but tells us nothing about this app: browser extensions,
 * cross-origin frames, and the ResizeObserver loop warning Chrome raises during ordinary layout.
 */
const IGNORED_MESSAGES = [
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  "Script error.",
];

/**
 * Builds the browser Rollbar configuration from runtime env.
 *
 * Kept separate from the instance so it can be asserted on directly -- most of the risk here is in
 * the config (scrubbing, `enabled`), not in Rollbar itself.
 */
export const buildRollbarConfig = (): Rollbar.Configuration => {
  const accessToken = getRuntimeEnv("BLOCKS_ROLLBAR_CLIENT_TOKEN");

  return {
    accessToken,
    // Reporting is opt-in on a seeded token. Unconfigured environments -- developer machines,
    // tests, any tier that has not been seeded -- construct an inert client rather than a broken
    // one, so the error boundary below still renders identically to production.
    enabled: accessToken.length > 0,
    environment: getRuntimeEnv("BLOCKS_ROLLBAR_ENV") || "unknown",
    captureUncaught: true,
    captureUnhandledRejections: true,
    scrubFields: SCRUB_FIELDS,
    ignoredMessages: IGNORED_MESSAGES,
    payload: {
      client: {
        javascript: {
          // Traces point into the hashed Vite bundles until source maps are uploaded, which needs
          // a code_version agreed with the build. See the note in the rollbar provider.
          source_map_enabled: false,
        },
      },
    },
  };
};

/**
 * Warns when an environment was seeded but its token was not.
 *
 * Only that combination is reported. A fully unconfigured app -- local dev, unit tests -- is a
 * legitimate state and stays quiet, but an environment carrying a name and no token is always a
 * seeding mistake, and the symptom is otherwise invisible: the app behaves normally and simply
 * reports nothing, forever.
 */
const warnIfPartiallyConfigured = (config: Rollbar.Configuration) => {
  const named = config.environment !== "unknown";

  if (named && !config.enabled) {
    console.error(
      `[rollbar] Error reporting is OFF for environment "${config.environment}": ` +
        "BLOCKS_ROLLBAR_CLIENT_TOKEN is not set.",
    );
  }
};

let instance: Rollbar | undefined;

/**
 * The one Rollbar instance for the app. Created on first use rather than at import time so that
 * merely importing this module -- as a unit test might -- installs no window handlers.
 */
export const getRollbar = (): Rollbar => {
  if (!instance) {
    const config = buildRollbarConfig();
    warnIfPartiallyConfigured(config);
    instance = new Rollbar(config);
  }

  return instance;
};
