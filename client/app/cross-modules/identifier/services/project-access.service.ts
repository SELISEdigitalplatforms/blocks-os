import { http } from "@/lib/http/http-client";
import { PEOPLE_ENDPOINTS } from "@blocks-identifier/constants/endpoint.constant";
import {
  IGetMyAccessResponse,
  ISaveAccessPolicyPayload,
  ISaveAccessPolicyResponse,
} from "@blocks-identifier/models/project-access.model";

export class ProjectAccessService {
  /**
   * What the caller may see and do in one project group.
   *
   * Shapes the UI and nothing more — every write is re-checked server-side by the endpoint's
   * own `[ProjectPolicy]`, so a response tampered with in the browser buys nothing.
   */
  getMyAccess(projectGroupId: string): Promise<IGetMyAccessResponse> {
    const query = new URLSearchParams({ ProjectGroupId: projectGroupId });
    return http.get(`${PEOPLE_ENDPOINTS.GET_MY_ACCESS}?${query.toString()}`);
  }

  /** Replaces a member's grants across every one of their rows in the group. Owner only. */
  saveAccessPolicy(payload: ISaveAccessPolicyPayload): Promise<ISaveAccessPolicyResponse> {
    return http.post(PEOPLE_ENDPOINTS.SAVE_ACCESS_POLICY, payload);
  }
}

export const projectAccessService = new ProjectAccessService();
