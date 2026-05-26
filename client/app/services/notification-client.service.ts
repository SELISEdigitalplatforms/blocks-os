import { getRuntimeEnv } from "@/lib/runtime-env";
import { HttpTransportType, HubConnection, HubConnectionBuilder } from "@microsoft/signalr";

export class NotificationClientService {
  public connection: HubConnection;

  constructor() {
    this.connection = new HubConnectionBuilder()
      .withUrl(
        `${getRuntimeEnv("BLOCKS_LOGIC_BASE_URL")}/NotificationHub?x-blocks-key=${getRuntimeEnv("BLOCKS_X_BLOCKS_KEY")}`,
        {
          transport: HttpTransportType.WebSockets,
        },
      )
      .withAutomaticReconnect()
      .build();
  }

  async connect() {
    if (this.connection.state === "Disconnected") {
      await this.connection.start();
    }
  }

  async disconnect() {
    if (this.connection.state !== "Disconnected") {
      await this.connection.stop();
    }
  }
}

export const notificationClientService = new NotificationClientService();
