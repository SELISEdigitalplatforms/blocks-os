import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ serviceName: "iam", viewerProps: undefined as Record<string, unknown> | undefined }));

vi.mock("@/components/breadcrumb/breadcrumb", () => ({ default: () => <div data-testid="crumb" /> }));
vi.mock("@/hooks/use-lmt-base-path", () => ({ useLmtBasePath: () => "/app/lmt" }));
vi.mock("react-router-dom", () => ({ useParams: () => ({ serviceName: h.serviceName }) }));
vi.mock("@blocks-lmt/constants/services.constant", () => ({
  SERVICES: [{ name: "iam", serviceName: "blocks-iam", label: "IAM", showInLogs: true }],
}));
vi.mock("@blocks-lmt/constants/logs-service-names.constant", () => ({
  getLmtLogCollections: (name: string) => ({ api: `${name}-api`, worker: `${name}-worker` }),
}));
vi.mock("@blocks-lmt/constants/logs-service-meta.constant", () => ({
  LOG_SERVICE_AI_QUERIES: { iam: ["q1"] },
  LOG_SERVICE_AI_DESCRIPTION: "desc",
}));
vi.mock("@blocks-lmt/components", () => ({
  LogsViewer: (props: Record<string, unknown>) => {
    h.viewerProps = props;
    return <div data-testid="viewer" />;
  },
}));

import { LmtServiceLogsRoute } from "./service-logs";

describe("LmtServiceLogsRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.serviceName = "iam";
  });

  it("renders the logs viewer with api and worker collections for a known service", () => {
    render(<LmtServiceLogsRoute />);
    expect(screen.getByTestId("viewer")).toBeTruthy();
    const services = h.viewerProps?.services as Array<{ label: string }>;
    expect(services.map((s) => s.label)).toEqual(["Api", "Worker"]);
    expect(h.viewerProps?.predefinedQueries).toEqual(["q1"]);
  });

  it("shows a not-configured message for an unknown service", () => {
    h.serviceName = "unknown";
    render(<LmtServiceLogsRoute />);
    expect(screen.getByText("Logs are not configured for this service.")).toBeTruthy();
    expect(screen.queryByTestId("viewer")).toBeNull();
  });
});
