import { ICreateModelPayload } from "@blocks-ai/types/aimodel.service.type";
import { z } from "zod";
import { isParsableUrl } from "@/lib/url-format";
import { ProviderToPlatformMap, ServicePlatform } from "./aimodel-provider.utils";
import { tStatic } from "@seliseblocks/genesis-os";

const KEY_API_KEY_IS_REQUIRED = "AIMODEL_FORM_UTILS.API_KEY_IS_REQUIRED";
const KEY_ENTER_A_VALID_URL = "AIMODEL_FORM_UTILS.ENTER_A_VALID_URL";
const KEY_MODEL_IS_REQUIRED = "AIMODEL_FORM_UTILS.MODEL_IS_REQUIRED";

const I18N_MODULE = "os.ai";

export const createOpenAIModelSchema = () =>
  z.object({
    model: z.string().trim().min(1, tStatic(I18N_MODULE, KEY_MODEL_IS_REQUIRED)),
    url: z.string().trim().refine(isParsableUrl, tStatic(I18N_MODULE, KEY_ENTER_A_VALID_URL)),
    apiKey: z.string().min(1, tStatic(I18N_MODULE, KEY_API_KEY_IS_REQUIRED)),
    organizationId: z.string().trim().optional(),
    projectId: z.string().trim().optional(),
  });
type FormSchemaOpenai = z.infer<ReturnType<typeof createOpenAIModelSchema>>;
export const OpenAIModelDefaults = (defaultModel: string): FormSchemaOpenai => ({
  model: defaultModel,
  url: "",
  apiKey: "",
  organizationId: "",
  projectId: "",
});

export const createOfficialApiModelSchema = () =>
  z.object({
    model: z.string().trim().min(1, tStatic(I18N_MODULE, KEY_MODEL_IS_REQUIRED)),
    url: z.string().trim().refine(isParsableUrl, tStatic(I18N_MODULE, KEY_ENTER_A_VALID_URL)),
    apiKey: z.string().min(1, tStatic(I18N_MODULE, KEY_API_KEY_IS_REQUIRED)),
  });
type FormSchemaOfficialApi = z.infer<ReturnType<typeof createOfficialApiModelSchema>>;
export const OfficialApiModelDefaults = (defaultModel: string): FormSchemaOfficialApi => ({
  model: defaultModel,
  url: "",
  apiKey: "",
});

export const createOpenDeploymentModelSchema = () =>
  z.object({
    model: z.string().trim().min(1, tStatic(I18N_MODULE, KEY_MODEL_IS_REQUIRED)),
    url: z.string().trim().refine(isParsableUrl, tStatic(I18N_MODULE, KEY_ENTER_A_VALID_URL)),
    deploymentName: z
      .string()
      .trim()
      .min(1, tStatic(I18N_MODULE, "AIMODEL_FORM_UTILS.DEPLOYMENT_NAME_IS_REQUIRED")),
    apiKey: z.string().min(1, tStatic(I18N_MODULE, KEY_API_KEY_IS_REQUIRED)),
  });
type FormSchemaOpenDeployment = z.infer<ReturnType<typeof createOpenDeploymentModelSchema>>;
export const OpenDeploymentDefaults = (defaultModel: string): FormSchemaOpenDeployment => ({
  model: defaultModel,
  url: "-",
  deploymentName: "-",
  apiKey: "",
});

export interface UniversalFormInput {
  version?: string;
  model?: string;
  displayName?: string;
  apiKey?: string;
  url?: string;
  organizationId?: string;
  projectId?: string;
  apiVersion?: string;
  deploymentName?: string;
  DefaultTemp?: number;
  MaxTokens?: number;
  customParameters?: Record<string, unknown>;
  customHeaders?: Record<string, string>;
}

export const transformToUniversal = (
  provider: string,
  projectKey: string,
  form: UniversalFormInput,
): ICreateModelPayload => {
  return {
    provider,
    service_platform: ProviderToPlatformMap[provider],
    version: form.version ?? "",
    model_name: form.model ?? "",
    display_name: form.displayName ?? "",
    api_key: form.apiKey ?? "",
    base_url: form.url ?? "",
    openai_organization_id: form.organizationId ?? "",
    openai_project_id: form.projectId ?? "",
    api_version: form.apiVersion ?? "",
    deployment_name: form.deploymentName ?? "",
    project_key: projectKey,
    DefaultTemp: form.DefaultTemp ?? 0.3,
    MaxTokens: form.MaxTokens ?? 10922,
    custom_parameters: form.customParameters ?? {},
    custom_headers: form.customHeaders ?? {},
  };
};

export const resolveModelConfig = (
  provider: string,
  servicePlatform: ServicePlatform,
  modelOptions: { model: string; goodName: string }[],
) => {
  const defaultModel = modelOptions[0]?.model ?? "--";

  if (provider === "openai") {
    return {
      schema: createOpenAIModelSchema(),
      defaultValues: OpenAIModelDefaults(defaultModel),
      fields: ["model", "url", "apiKey", "organizationId", "projectId"],
    };
  }

  if (servicePlatform === ServicePlatform.OPEN_DEPLOYMENT) {
    return {
      schema: createOpenDeploymentModelSchema(),
      defaultValues: OpenDeploymentDefaults(defaultModel),
      fields: ["model", "url", "deploymentName", "apiKey"],
    };
  }

  return {
    schema: createOfficialApiModelSchema(),
    defaultValues: OfficialApiModelDefaults(defaultModel),
    fields: ["model", "url", "apiKey"],
  };
};
