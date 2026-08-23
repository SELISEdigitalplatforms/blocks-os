import { http } from "@/lib/http/http-client";
import {
  IBlocksServiceItem,
  IGetLiveLogsPayload,
  IGetLogsByDatePayload,
  IGetLogsPayload,
  ILog,
} from "../models/log.model";
import { IAPIResponse } from "@/models/api-response";
import { LOG_ENDPOINTS } from "../constants/endpoint.constant";

export class LogService {
  async getLogs(payload: IGetLogsPayload): Promise<IAPIResponse<ILog[]>> {
    return http.post<IAPIResponse<ILog[]>>(LOG_ENDPOINTS.GET_LOGS, payload);
  }

  async getLogsByDate(payload: IGetLogsByDatePayload): Promise<IAPIResponse<ILog[]>> {
    return http.post<IAPIResponse<ILog[]>>(LOG_ENDPOINTS.GET_LOGS_BY_DATE, payload);
  }

  async getLiveLog(paylaod: IGetLiveLogsPayload): Promise<IAPIResponse<ILog[]>> {
    const params = new URLSearchParams({
      Name: paylaod.serviceName,
      LastDate: paylaod.lastDate,
      ProjectKey: paylaod.projectKey,
    });

    paylaod.serviceNames?.forEach((serviceName) => {
      params.append("ServiceNames", serviceName);
    });

    const url = `${LOG_ENDPOINTS.LIVE}?${params.toString()}`;
    return http.get<IAPIResponse<ILog[]>>(url);
  }

  async getBlocksServices(): Promise<IBlocksServiceItem[]> {
    return http.get<IBlocksServiceItem[]>(LOG_ENDPOINTS.GET_BLOCKS_SERVICES);
  }
}
