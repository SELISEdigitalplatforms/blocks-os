import { tStatic } from "@seliseblocks/genesis-os";

export const LOG_SERVICE_AI_QUERIES: Record<string, string[]> = {
  get iam() {
    return [
      tStatic("os.lmt", "LOGS_SERVICE_META.ANY_IAM_ERRORS_IN_THE"),
      tStatic("os.lmt", "LOGS_SERVICE_META.SHOW_RECENT_WARNINGS_IN_BLOCKS"),
      tStatic("os.lmt", "LOGS_SERVICE_META.HIGHLIGHT_UNUSUAL_IAM_ACTIVITY"),
    ];
  },
  get os() {
    return [
      tStatic("os.lmt", "LOGS_SERVICE_META.ANY_ERRORS_IN_THE_LAST"),
      tStatic("os.lmt", "LOGS_SERVICE_META.SHOW_RECENT_WARNINGS_IN_BLOCKS_2"),
      tStatic("os.lmt", "LOGS_SERVICE_META.HIGHLIGHT_UNUSUAL_OS_ACTIVITY"),
    ];
  },
  get monitor() {
    return [
      tStatic("os.lmt", "LOGS_SERVICE_META.ANY_MONITOR_ERRORS_IN_THE"),
      tStatic("os.lmt", "LOGS_SERVICE_META.SHOW_RECENT_WARNINGS_IN_BLOCKS_3"),
      tStatic("os.lmt", "LOGS_SERVICE_META.HIGHLIGHT_UNUSUAL_MONITORING_ACTIVITY"),
    ];
  },
  get localization() {
    return [
      tStatic("os.lmt", "LOGS_SERVICE_META.ANY_LOCALIZATION_ERRORS_IN_THE"),
      tStatic("os.lmt", "LOGS_SERVICE_META.SHOW_RECENT_WARNINGS_IN_BLOCKS_4"),
      tStatic("os.lmt", "LOGS_SERVICE_META.HIGHLIGHT_UNUSUAL_TRANSLATION_OR_LOCALE"),
    ];
  },
  get data() {
    return [
      tStatic("os.lmt", "LOGS_SERVICE_META.ANY_DATA_SERVICE_ERRORS_IN"),
      tStatic("os.lmt", "LOGS_SERVICE_META.SHOW_RECENT_WARNINGS_IN_BLOCKS_5"),
      tStatic("os.lmt", "LOGS_SERVICE_META.HIGHLIGHT_UNUSUAL_STORAGE_OR_PIPELINE"),
    ];
  },
  get release() {
    return [
      tStatic("os.lmt", "LOGS_SERVICE_META.ANY_RELEASE_ERRORS_IN_THE"),
      tStatic("os.lmt", "LOGS_SERVICE_META.SHOW_RECENT_WARNINGS_IN_BLOCKS_6"),
      tStatic("os.lmt", "LOGS_SERVICE_META.HIGHLIGHT_UNUSUAL_BUILD_OR_DEPLOY"),
    ];
  },
  get utilities() {
    return [
      tStatic("os.lmt", "LOGS_SERVICE_META.ANY_UTILITIES_ERRORS_IN_THE"),
      tStatic("os.lmt", "LOGS_SERVICE_META.SHOW_RECENT_WARNINGS_IN_BLOCKS_7"),
      tStatic("os.lmt", "LOGS_SERVICE_META.HIGHLIGHT_UNUSUAL_CROSS_CUTTING_JOB"),
    ];
  },
  get studio() {
    return [
      tStatic("os.lmt", "LOGS_SERVICE_META.ANY_STUDIO_ERRORS_IN_THE"),
      tStatic("os.lmt", "LOGS_SERVICE_META.SHOW_RECENT_WARNINGS_IN_BLOCKS_8"),
      tStatic("os.lmt", "LOGS_SERVICE_META.HIGHLIGHT_UNUSUAL_BUILDER_OR_PUBLISHING"),
    ];
  },
  get agent() {
    return [
      tStatic("os.lmt", "LOGS_SERVICE_META.ANY_AGENT_ERRORS_IN_THE"),
      tStatic("os.lmt", "LOGS_SERVICE_META.SHOW_RECENT_WARNINGS_IN_BLOCKS_9"),
      tStatic("os.lmt", "LOGS_SERVICE_META.HIGHLIGHT_UNUSUAL_AGENT_OR_TOOL"),
    ];
  },
};

export const getLogServiceAiDescription = () =>
  tStatic("os.lmt", "LOGS_SERVICE_META.AI_DESCRIPTION");
