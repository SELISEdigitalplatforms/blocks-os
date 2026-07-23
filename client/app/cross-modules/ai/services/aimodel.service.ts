import { http } from "@/lib/http/http-client";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { AI_ENDPOINTS } from "@blocks-ai/constants/endpoint.constant";
import {
  ICreateModelPayload,
  IModelResponse,
  IModelListPayload,
  IModelListResponse,
  IModelInfo,
  IUpdateModelPayload,
  IValidateModelResponse,
  IProvider,
  ISeedModelInfo,
  ModelStatus,
} from "@blocks-ai/types/aimodel.service.type";

const agentsBase = () => getRuntimeEnv("BLOCKS_AGENTS_BASE_URL");

export class ModelService {
  createModel(payload: ICreateModelPayload): Promise<IModelResponse> {
    return http.post(
      `${agentsBase()}/api${AI_ENDPOINTS.MODELS}/`,
      payload,
      undefined,
      { absoluteUrl: true },
    );
  }

  getModels(
    payload: IModelListPayload,
    project_key: string,
  ): Promise<IModelListResponse> {
    return http.get(
      `${agentsBase()}/api${AI_ENDPOINTS.MODELS}/?provider=${payload.provider}&search=${payload.search ?? ""}&page=${payload.page}&page_size=${payload.page_size}&project_key=${project_key}`,
      undefined,
      { absoluteUrl: true },
    );
  }

  getAllModels(
    payload: IModelListPayload,
    project_key: string,
  ): Promise<IModelListResponse> {
    const params = new URLSearchParams();

    if (payload.provider) params.append("provider", payload.provider);
    if (payload.model_type) params.append("model_type", payload.model_type);
    if (payload.is_active !== undefined && payload.is_active !== null)
      params.append("is_active", String(payload.is_active));
    if (payload.search) params.append("search", payload.search);
    if (payload.page) params.append("page", String(payload.page));
    if (payload.page_size)
      params.append("page_size", String(payload.page_size));
    if (
      payload.status &&
      (payload.status == ModelStatus.VALID ||
        payload.status == ModelStatus.INVALID)
    )
      params.append("status", payload.status);

    params.append("project_key", project_key);

    const queryString = params.toString();
    const url = `${agentsBase()}/api${AI_ENDPOINTS.MODELS}/${queryString ? `?${queryString}` : ""}`;

    return http.get(url, undefined, { absoluteUrl: true });
  }

  getModelById(modelId: string, project_key: string): Promise<IModelInfo> {
    return http.get(
      `${agentsBase()}/api${AI_ENDPOINTS.MODEL_BY_ID.replace(":id", modelId)}?project_key=${project_key}`,
      undefined,
      { absoluteUrl: true },
    );
  }

  updateModel(
    modelId: string,
    payload: IUpdateModelPayload,
  ): Promise<IModelResponse> {
    return http.post(
      `${agentsBase()}/api${AI_ENDPOINTS.MODEL_BY_ID.replace(":id", modelId)}`,
      payload,
      undefined,
      { absoluteUrl: true },
    );
  }

  deleteModel(modelId: string, project_key: string): Promise<IModelResponse> {
    return http.delete(
      `${agentsBase()}/api${AI_ENDPOINTS.MODEL_BY_ID.replace(":id", modelId)}?project_key=${project_key}`,
      undefined,
      { absoluteUrl: true },
    );
  }

  validateModel(
    modelId: string,
    project_key: string,
  ): Promise<IValidateModelResponse> {
    return http.post(
      `${agentsBase()}/api${AI_ENDPOINTS.MODEL_VALIDATE.replace(":id", modelId)}?project_key=${project_key}`,
      "",
      undefined,
      { absoluteUrl: true },
    );
  }

  getSeedProviders(): Promise<IProvider[]> {
    return http.get(
      `${agentsBase()}/api${AI_ENDPOINTS.MODEL_SEED_PROVIDERS}`,
      undefined,
      { absoluteUrl: true },
    );
  }

  getSeedModelsByProvider(provider: string): Promise<ISeedModelInfo[]> {
    return http.get(
      `${agentsBase()}/api${AI_ENDPOINTS.MODEL_SEED_BY_PROVIDER.replace(":provider", provider)}`,
      undefined,
      { absoluteUrl: true },
    );
  }
}

export const modelService = new ModelService();
