import { z } from "zod";
import { tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.environments";

export type MigrationServiceOption = {
  name: string;
  label: string;
  selected: boolean;
  overrideData: boolean;
};

export const getEnvironmentServiceSelectionFormDefaultValue = () => ({
  sourceEnvironment: "",
  sourceEnvironmentName: "",
  targetEnvironment: "",
  targetEnvironmentName: "",
  services: [
    {
      name: "Authentication",
      label: tStatic(I18N_MODULE, "MIGRATION_FORM_SCHEMA.AUTHENTICATION"),
      selected: false,
      overrideData: false,
    },
    { name: "IAM", label: "IAM", selected: false, overrideData: false },
    { name: "MFA", label: "MFA", selected: false, overrideData: false },
    {
      name: "CAPTCHA",
      label: tStatic(I18N_MODULE, "MIGRATION_FORM_SCHEMA.CAPTCHA"),
      selected: false,
      overrideData: false,
    },
    {
      name: "Email",
      label: tStatic(I18N_MODULE, "common:EMAIL"),
      selected: false,
      overrideData: false,
    },
    {
      name: "DataGateway",
      label: tStatic(I18N_MODULE, "MIGRATION_FORM_SCHEMA.DATA_GATEWAY"),
      selected: false,
      overrideData: false,
    },
    {
      name: "Notifications",
      label: tStatic(I18N_MODULE, "MIGRATION_FORM_SCHEMA.NOTIFICATIONS"),
      selected: false,
      overrideData: false,
    },
    {
      name: "Storage",
      label: tStatic(I18N_MODULE, "MIGRATION_FORM_SCHEMA.STORAGE"),
      selected: false,
      overrideData: false,
    },
    {
      name: "Language",
      label: tStatic(I18N_MODULE, "MIGRATION_FORM_SCHEMA.LOCALIZATION"),
      selected: false,
      overrideData: false,
    },
  ] as MigrationServiceOption[],
});

export const reviewConfirmFormDefaultValue = {
  confirmed: false,
};

export const createEnvironmentServiceSelectionFormSchema = () =>
  z.object({
    sourceEnvironment: z
      .string()
      .min(1, tStatic(I18N_MODULE, "MIGRATION_FORM_SCHEMA.SOURCE_ENVIRONMENT_IS_REQUIRED")),
    sourceEnvironmentName: z.string(),
    targetEnvironment: z
      .string()
      .min(1, tStatic(I18N_MODULE, "MIGRATION_FORM_SCHEMA.TARGET_ENVIRONMENT_IS_REQUIRED")),
    targetEnvironmentName: z.string(),
    services: z
      .array(
        z.object({
          name: z.string(),
          label: z.string(),
          selected: z.boolean(),
          overrideData: z.boolean(),
        }),
      )
      .refine((services) => services.some((service) => service.selected), {
        message: tStatic(I18N_MODULE, "MIGRATION_FORM_SCHEMA.AT_LEAST_ONE_SERVICE_MUST"),
      }),
  });

export const createMigrationVerificationSchema = () =>
  z.object({
    verificationCode: z
      .string()
      .min(5, tStatic(I18N_MODULE, "MIGRATION_FORM_SCHEMA.VERIFICATION_CODE_MUST_BE_5"))
      .max(5, tStatic(I18N_MODULE, "MIGRATION_FORM_SCHEMA.VERIFICATION_CODE_MUST_BE_5")),
  });

export const MIGRATION_SERVICE_NAME_TO_ID: Record<string, number> = {
  Authentication: 0,
  IAM: 1,
  MFA: 2,
  CAPTCHA: 3,
  Email: 4,
  DataGateway: 5,
  Notifications: 6,
  Storage: 7,
  Language: 8,
};

/** Matches blocks-app-next data-migration availability rules. */
export const MIGRATION_SERVICE_UI_CATALOG = [
  { id: "Authentication", name: "Authentication", chips: ["Template"], available: false },
  { id: "IAM", name: "IAM", chips: ["Schemas"], available: false },
  { id: "MFA", name: "MFA", chips: ["Key", "Module"], available: false },
  { id: "CAPTCHA", name: "CAPTCHA", chips: ["Key", "Module"], available: false },
  { id: "Email", name: "Email", chips: ["Templates"], available: false },
  {
    id: "DataGateway",
    name: "Data Gateway",
    chips: ["SchemaDefinitions"],
    available: false,
  },
  { id: "Notifications", name: "Notifications", chips: ["Key", "Module"], available: false },
  { id: "Storage", name: "Storage", chips: ["Key", "Module"], available: false },
  { id: "Language", name: "Localization", chips: ["Key", "Module"], available: true },
] as const;
