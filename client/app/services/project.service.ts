import { http } from "@/lib/http-client";
import { PROJECT_ENDPOINTS } from "@blocks-identifier/constants/endpoint.constant";
import { IGetProjectResponse, IProjectGroup } from "@/models/project.model";

export class ProjectService {
  getProjects(
    page = 0,
    pageSize = 100,
    tenantGroupId = "",
  ): Promise<IProjectGroup[]> {
    const url = `${PROJECT_ENDPOINTS.GETS}?page=${page}&pageSize=${pageSize}&tenantGroupId=${tenantGroupId}`;
    return http.get(url);
  }

  getProject(): Promise<IGetProjectResponse> {
    const url = `${PROJECT_ENDPOINTS.GET}`;
    return http.get(url);
  }
}

export const projectService = new ProjectService();
