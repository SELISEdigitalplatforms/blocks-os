import { http } from "@/lib/http/http-client";
import {
  IDataGatewayConfiguration,
  IDataGatewayConfigurationSavePayload,
  IDataGatewayConfigurationSaveResponse,
} from "../models/data-gateway.model";
import { DATA_GATEWAY_CONFIG_ENDPOINTS } from "../constants/endpoint.constant";

export class DataGatewayConfiguration {
  gets(): Promise<IDataGatewayConfiguration[]> {
    return http.get<IDataGatewayConfiguration[]>(DATA_GATEWAY_CONFIG_ENDPOINTS.GET_CONFIGS);
  }

  get(projectKey: string): Promise<IDataGatewayConfiguration> {
    return http.get<IDataGatewayConfiguration>(
      `${DATA_GATEWAY_CONFIG_ENDPOINTS.GET_CONFIG}?ProjectKey=${encodeURIComponent(projectKey)}`,
    );
  }

  save(
    payload: IDataGatewayConfigurationSavePayload,
  ): Promise<IDataGatewayConfigurationSaveResponse> {
    return http.post(DATA_GATEWAY_CONFIG_ENDPOINTS.SAVE_CONFIG, payload);
  }
}
