import { http } from "@/lib/http-client";
import { PROJECT_ENDPOINTS } from "@blocks-identifier/constants/endpoint.constant";
import { IGetProjectPayload, IGetProjectResponse, IProjectGroup } from "@/models/project.model";
import { getRuntimeEnv } from "@/lib/runtime-env";

export class ProjectService {
  getProjects(
    page = 0,
    pageSize = 100,
    tenantGroupId = "",
  ): Promise<IProjectGroup[]> {
    const url = `${getRuntimeEnv("BLOCKS_OS_BASE_URL")}${PROJECT_ENDPOINTS.GETS}?page=${page}&pageSize=${pageSize}&tenantGroupId=${tenantGroupId}`;
    return http.get(url, undefined, { absoluteUrl: true });
  }

 getProject(payload: IGetProjectPayload): Promise<IGetProjectResponse> {
    const url = `${getRuntimeEnv("BLOCKS_OS_BASE_URL")}${PROJECT_ENDPOINTS.GET}?projectId=${payload.projectId}`;
    return http.get(url, undefined, { absoluteUrl: true });
  }
}

export const projectService = new ProjectService();
