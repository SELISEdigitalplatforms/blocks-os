import { z } from "zod";

export type MigrationServiceOption = {
  name: string;
  label: string;
  selected: boolean;
  overrideData: boolean;
};

export const environmentServiceSelectionFormDefaultValue = {
  sourceEnvironment: "",
  sourceEnvironmentName: "",
  targetEnvironment: "",
  targetEnvironmentName: "",
  services: [
    { name: "Authentication", label: "Authentication", selected: false, overrideData: false },
    { name: "IAM", label: "IAM", selected: false, overrideData: false },
    { name: "MFA", label: "MFA", selected: false, overrideData: false },
    { name: "CAPTCHA", label: "CAPTCHA", selected: false, overrideData: false },
    { name: "Email", label: "Email", selected: false, overrideData: false },
    { name: "DataGateway", label: "Data Gateway", selected: false, overrideData: false },
    { name: "Notifications", label: "Notifications", selected: false, overrideData: false },
    { name: "Storage", label: "Storage", selected: false, overrideData: false },
    { name: "Localization", label: "Localization", selected: false, overrideData: false },
  ] as MigrationServiceOption[],
};

export const reviewConfirmFormDefaultValue = {
  confirmed: false,
};

export const environmentServiceSelectionFormSchema = z.object({
  sourceEnvironment: z.string().min(1, "Source environment is required"),
  sourceEnvironmentName: z.string(),
  targetEnvironment: z.string().min(1, "Target environment is required"),
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
      message: "At least one service must be selected",
    }),
});

export const migrationVerificationSchema = z.object({
  verificationCode: z
    .string()
    .min(5, "Verification code must be 5 digits")
    .max(5, "Verification code must be 5 digits"),
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
  Localization: 8,
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
    chips: ["SchemaDefinitions", "DataServiceConfigurations"],
    available: false,
  },
  { id: "Notifications", name: "Notifications", chips: ["Key", "Module"], available: false },
  { id: "Storage", name: "Storage", chips: ["Key", "Module"], available: false },
  { id: "Localization", name: "Localization", chips: ["Key", "Module"], available: true },
] as const;
