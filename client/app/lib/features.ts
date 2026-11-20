import { getRuntimeEnv } from "@/lib/runtime-env";

/**
 * Features that need a service not every installation runs. Each one is off unless its runtime
 * setting is "true", so an installation without that service shows no screen, link or request
 * that points at it.
 *
 * - `BLOCKS_FEATURE_AGENTS`: the AI credits page and menu, the LMT query agent, and the agents
 *   service's Swagger link. They call `BLOCKS_AGENTS_BASE_URL`.
 * - `BLOCKS_FEATURE_STUDIO`: the Studio service's Swagger link. The server reads the same
 *   setting before it adds Studio's domain to a new project.
 */
export type FeatureKey = "BLOCKS_FEATURE_AGENTS" | "BLOCKS_FEATURE_STUDIO";

export const isFeatureEnabled = (key: FeatureKey): boolean =>
  getRuntimeEnv(key).trim().toLowerCase() === "true";

export const isAgentsEnabled = (): boolean => isFeatureEnabled("BLOCKS_FEATURE_AGENTS");

export const isStudioEnabled = (): boolean => isFeatureEnabled("BLOCKS_FEATURE_STUDIO");
