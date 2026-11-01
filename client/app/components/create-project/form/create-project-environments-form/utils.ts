import { z } from "zod";
import { tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.create-project";

export const createProjectEnvironmentFormDefaultValue = {
  environments: [] as { value: string }[],
};

export const createCreateProjectEnvironmentFormSchema = () =>
  z.object({
    environments: z
      .array(
        z.object({
          value: z.string(),
        }),
      )
      .min(1, tStatic(I18N_MODULE, "UTILS.AT_LEAST_ONE_ENVIRONMENT_IS")),
  });

export const getEnvironmentOptions = () => [
  {
    index: 0,
    label: tStatic(I18N_MODULE, "UTILS.DEVELOPMENT"),
    value: "dev",
    subtext: tStatic(I18N_MODULE, "UTILS.FOR_DAY_TO_DAY_DEVELOPMENT"),
  },
  {
    index: 1,
    label: tStatic(I18N_MODULE, "UTILS.TESTING"),
    value: "test",
    subtext: tStatic(I18N_MODULE, "UTILS.FOR_QA_TESTING_AND_VALIDATION"),
  },
  {
    index: 2,
    label: tStatic(I18N_MODULE, "UTILS.STAGING"),
    value: "stg",
    subtext: tStatic(I18N_MODULE, "UTILS.FOR_FINAL_PRE_PROD_VALIDATION"),
  },
  {
    index: 3,
    label: "IAT",
    value: "iat",
    subtext: tStatic(I18N_MODULE, "UTILS.FOR_TESTING_SERVICE_INTEGRATIONS"),
  },
  {
    index: 4,
    label: "UAT",
    value: "uat",
    subtext: tStatic(I18N_MODULE, "UTILS.FOR_END_USER_OR_STAKEHOLDER"),
  },
  {
    index: 5,
    label: tStatic(I18N_MODULE, "UTILS.PROD_SHADOW"),
    value: "prod-shadow",
    subtext: tStatic(I18N_MODULE, "UTILS.FOR_MIRRORING_PRODUCTION_DATA"),
  },
  {
    index: 6,
    label: tStatic(I18N_MODULE, "UTILS.PRE_PROD"),
    value: "pre-prod",
    subtext: tStatic(I18N_MODULE, "UTILS.FOR_LOAD_TESTING_SECURITY_CHECKS"),
  },
  {
    index: 7,
    label: tStatic(I18N_MODULE, "UTILS.PRODUCTION"),
    value: "prod",
    subtext: tStatic(I18N_MODULE, "UTILS.THE_LIVE_ENVIRONMENT_SERVING"),
  },
];
