export const AI_ENDPOINTS = {
  AGENT_QUERY_LMT_STREAM: "/ai-agent/query-lmt/stream",
  MODELS: "/models",
  MODEL_BY_ID: "/models/:id",
  MODEL_VALIDATE: "/models/:id/validate",
  MODEL_SEED_PROVIDERS: "/models/seed/providers",
  MODEL_SEED_BY_PROVIDER: "/models/seed/providers/:provider",
} as const;
