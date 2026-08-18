import { http } from "@/lib/http/http-client";
import {
  CreateRolePayload,
  GetRolesPayload,
  GetRolesResponse,
  IGetRolePayload,
  IGetRoleResponse,
  IRole,
  SetRoles,
  UpdateRolePayload,
} from "@blocks-idp/iam/models/role";
import { ROLE_ENDPOINTS } from "../constants/endpoint.constant";
import { ArchiveResponse } from "../constants/archive-error-messages";

export class RoleService {
  getRoles(payload: GetRolesPayload): Promise<GetRolesResponse> {
    return http.post(ROLE_ENDPOINTS.GET_ROLES, payload, undefined, {
      absoluteUrl: true,
    });
  }

  getRoleById(payload: IGetRolePayload): Promise<IGetRoleResponse> {
    return http.get(`${ROLE_ENDPOINTS.GET_ROLES}/${payload.id}`, undefined, {
      absoluteUrl: true,
    });
  }

  addRole(payload: CreateRolePayload): Promise<IRole> {
    return http.post(ROLE_ENDPOINTS.CREATE_ROLE, payload, undefined, {
      absoluteUrl: true,
    });
  }

  updateRole(payload: UpdateRolePayload) {
    return http.post<{
      errors: unknown;
      isSuccess: boolean;
      itemId: string;
    }>(ROLE_ENDPOINTS.UPDATE_ROLE, payload, undefined, { absoluteUrl: true });
  }

  /**
   * Archives a role. Soft delete on the backend -- the document survives, so this is safe to
   * expose from the list. Rejections arrive as a thrown HttpError carrying the reason code; see
   * ARCHIVE_ERROR_MESSAGES.
   */
  deleteRole(id: string): Promise<ArchiveResponse> {
    return http.delete(`${ROLE_ENDPOINTS.GET_ROLES}/${id}`, undefined, {
      absoluteUrl: true,
    });
  }

  setRoles(addSetRolesPayload: SetRoles): Promise<SetRoles> {
    return http.post<SetRoles>(ROLE_ENDPOINTS.SET_ROLES, { ...addSetRolesPayload }, undefined, {
      absoluteUrl: true,
    });
  }
}

export const roleService = new RoleService();
