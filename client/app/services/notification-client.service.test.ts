import { beforeEach, describe, expect, it, vi } from "vitest";
import { HubConnectionBuilder } from "@microsoft/signalr";
import { NotificationClientService } from "./notification-client.service";

const { connection, startMock, stopMock } = vi.hoisted(() => {
  const startMock = vi.fn();
  const stopMock = vi.fn();
  return {
    startMock,
    stopMock,
    connection: {
      state: "Disconnected" as string,
      start: startMock,
      stop: stopMock,
    },
  };
});

vi.mock("@microsoft/signalr", () => ({
  // Regular function (not an arrow) so it is usable with `new`.
  HubConnectionBuilder: vi.fn(function () {
    return {
      withUrl: () => ({
        withAutomaticReconnect: () => ({
          build: () => connection,
        }),
      }),
    };
  }),
  HttpTransportType: { WebSockets: 1 },
}));

describe("NotificationClientService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startMock.mockResolvedValue(undefined);
    stopMock.mockResolvedValue(undefined);
    connection.state = "Disconnected";
  });

  it("wires up a hub connection through the builder", () => {
    const service = new NotificationClientService();
    expect(HubConnectionBuilder).toHaveBeenCalled();
    expect(service.connection).toBe(connection);
  });

  it("connect starts a disconnected connection", async () => {
    const service = new NotificationClientService();
    connection.state = "Disconnected";
    await service.connect();
    expect(startMock).toHaveBeenCalledTimes(1);
  });

  it("connect is a no-op when already connected", async () => {
    const service = new NotificationClientService();
    connection.state = "Connected";
    await service.connect();
    expect(startMock).not.toHaveBeenCalled();
  });

  it("disconnect stops a connected connection", async () => {
    const service = new NotificationClientService();
    connection.state = "Connected";
    await service.disconnect();
    expect(stopMock).toHaveBeenCalledTimes(1);
  });

  it("disconnect is a no-op when already disconnected", async () => {
    const service = new NotificationClientService();
    connection.state = "Disconnected";
    await service.disconnect();
    expect(stopMock).not.toHaveBeenCalled();
  });
});
