import { http } from "@/lib/http/http-client";
import { PROJECT_ENDPOINTS } from "@blocks-identifier/constants/endpoint.constant";
import {
  IGetProjectResponse,
  IProjectGroup,
  IRestoreProjectPayload,
  IRestoreProjectResponse,
} from "@/models/project.model";
import { getRuntimeEnv } from "@/lib/runtime-env";

export class ProjectService {
  getProjects(page = 0, pageSize = 100, tenantGroupId = ""): Promise<IProjectGroup[]> {
    const url = `${getRuntimeEnv("BLOCKS_OS_BASE_URL")}${PROJECT_ENDPOINTS.GETS}?page=${page}&pageSize=${pageSize}&tenantGroupId=${tenantGroupId}`;
    return http.get(url, undefined, { absoluteUrl: true });
  }

  // Resolves the project from the caller's auth context — there is no
  // parameter to pass; the token's tenant selects the project.
  getProject(): Promise<IGetProjectResponse> {
    const url = `${getRuntimeEnv("BLOCKS_OS_BASE_URL")}${PROJECT_ENDPOINTS.GET}`;
    return http.get(url, undefined, { absoluteUrl: true });
  }

  // Endpoint responds text/plain with the literal string "true"/"false" —
  // coerce here so callers only ever see a boolean.
  async getProjectStatus(itemId: string): Promise<boolean> {
    const url = `${getRuntimeEnv("BLOCKS_OS_BASE_URL")}${PROJECT_ENDPOINTS.GET_PROJECT_STATUS}?ItemId=${itemId}`;
    const res = await http.get<string | boolean>(url, undefined, { absoluteUrl: true });
    return res === true || res === "true";
  }

  restoreProject(payload: IRestoreProjectPayload): Promise<IRestoreProjectResponse> {
    const url = `${getRuntimeEnv("BLOCKS_OS_BASE_URL")}${PROJECT_ENDPOINTS.RESTORE}`;
    return http.post(url, payload, undefined, { absoluteUrl: true });
  }
}

export const projectService = new ProjectService();
