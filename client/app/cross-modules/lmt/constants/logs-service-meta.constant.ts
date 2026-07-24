export const LOG_SERVICE_AI_QUERIES: Record<string, string[]> = {
  iam: [
    "Any IAM errors in the last hour?",
    "Show recent warnings in blocks-iam",
    "Highlight unusual IAM activity",
  ],
  os: [
    "Any errors in the last hour for Blocks OS?",
    "Show recent warnings in blocks-os",
    "Highlight unusual OS activity",
  ],
  monitor: [
    "Any monitor errors in the last hour?",
    "Show recent warnings in blocks-monitor",
    "Highlight unusual monitoring activity",
  ],
  localization: [
    "Any localization errors in the last hour?",
    "Show recent warnings in blocks-localization",
    "Highlight unusual translation or locale delivery activity",
  ],
  data: [
    "Any data service errors in the last hour?",
    "Show recent warnings in blocks-data",
    "Highlight unusual storage or pipeline activity",
  ],
  release: [
    "Any release errors in the last hour?",
    "Show recent warnings in blocks-release",
    "Highlight unusual build or deploy activity",
  ],
  utilities: [
    "Any utilities errors in the last hour?",
    "Show recent warnings in blocks-utilities",
    "Highlight unusual cross-cutting job activity",
  ],
  studio: [
    "Any studio errors in the last hour?",
    "Show recent warnings in blocks-studio",
    "Highlight unusual builder or publishing activity",
  ],
  agent: [
    "Any agent errors in the last hour?",
    "Show recent warnings in blocks-agent",
    "Highlight unusual agent or tool-call activity",
  ],
};

export const LOG_SERVICE_AI_DESCRIPTION =
  "Hello! How can I assist you today? Here to answer questions and uncover insights.";
