import { http } from "@/lib/http/http-client";
import { ACTIONS_ENDPOINTS } from "../constants/endpoint.constant";
import type { IAction, IUpdateActionPayload } from "../models/actions.model";

export class ActionsService {
  gets(): Promise<IAction[]> {
    return http.get<IAction[]>(ACTIONS_ENDPOINTS.GETS);
  }

  update(payload: IUpdateActionPayload): Promise<boolean> {
    return http.post<boolean>(ACTIONS_ENDPOINTS.UPDATE, payload);
  }
}

export const actionsService = new ActionsService();
