import { DataGatewayConfiguration } from "./data-gateway-configuration.service";

export class DataGatewayService {
  constructor(public configuration: DataGatewayConfiguration) {}
}

export const dataGatewayService = new DataGatewayService(new DataGatewayConfiguration());
