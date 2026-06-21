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
}

export const LOG_SERVICE_AI_DESCRIPTION =
  "Hello! How can I assist you today? Here to answer questions and uncover insights."
