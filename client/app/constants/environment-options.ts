import { navText } from "@/constants/nav-text";

export const environmentOptions = [
  {
    index: 0,
    get label() {
      return navText("ENVIRONMENT_OPTIONS.DEVELOPMENT");
    },
    value: "dev",
    get subtext() {
      return navText("ENVIRONMENT_OPTIONS.FOR_DAY_TO_DAY_DEVELOPMENT");
    },
  },
  {
    index: 1,
    get label() {
      return navText("ENVIRONMENT_OPTIONS.TESTING");
    },
    value: "test",
    get subtext() {
      return navText("ENVIRONMENT_OPTIONS.FOR_QA_TESTING_AND_VALIDATION");
    },
  },
  {
    index: 2,
    get label() {
      return navText("ENVIRONMENT_OPTIONS.STAGING");
    },
    value: "stg",
    get subtext() {
      return navText("ENVIRONMENT_OPTIONS.FOR_FINAL_PRE_PROD_VALIDATION");
    },
  },
  {
    index: 3,
    get label() {
      return navText("ENVIRONMENT_OPTIONS.IAT");
    },
    value: "iat",
    get subtext() {
      return navText("ENVIRONMENT_OPTIONS.FOR_TESTING_SERVICE_INTEGRATIONS_ACROSS");
    },
  },
  {
    index: 4,
    get label() {
      return navText("ENVIRONMENT_OPTIONS.UAT");
    },
    value: "uat",
    get subtext() {
      return navText("ENVIRONMENT_OPTIONS.FOR_END_USER_OR_STAKEHOLDER");
    },
  },
  {
    index: 5,
    get label() {
      return navText("ENVIRONMENT_OPTIONS.PROD_SHADOW");
    },
    value: "prod-shadow",
    get subtext() {
      return navText("ENVIRONMENT_OPTIONS.FOR_MIRRORING_PRODUCTION_DATA_TRAFFIC");
    },
  },
  {
    index: 6,
    get label() {
      return navText("ENVIRONMENT_OPTIONS.PRE_PROD");
    },
    value: "pre-prod",
    get subtext() {
      return navText("ENVIRONMENT_OPTIONS.FOR_LOAD_TESTING_SECURITY_CHECKS");
    },
  },
  {
    index: 7,
    get label() {
      return navText("ENVIRONMENT_OPTIONS.PRODUCTION");
    },
    value: "prod",
    get subtext() {
      return navText("ENVIRONMENT_OPTIONS.THE_LIVE_ENVIRONMENT_SERVING_ACTUAL");
    },
  },
];
