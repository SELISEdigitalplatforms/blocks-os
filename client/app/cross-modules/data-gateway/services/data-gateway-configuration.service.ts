import { http } from "@/lib/http/http-client";
import {
  IDataGatewayConfiguration,
  IDataGatewayConfigurationSavePayload,
  IDataGatewayConfigurationSaveResponse,
} from "../models/data-gateway.model";
import { DATA_GATEWAY_CONFIG_ENDPOINTS } from "../constants/endpoint.constant";

export class DataGatewayConfiguration {
  // There is at most one configuration - it belongs to whichever tenant is ambient on the
  // request, so this takes no project key.
  get(): Promise<IDataGatewayConfiguration> {
    return http.get<IDataGatewayConfiguration>(DATA_GATEWAY_CONFIG_ENDPOINTS.GET_CONFIG);
  }

  save(
    payload: IDataGatewayConfigurationSavePayload,
  ): Promise<IDataGatewayConfigurationSaveResponse> {
    return http.post(DATA_GATEWAY_CONFIG_ENDPOINTS.SAVE_CONFIG, payload);
  }
}
