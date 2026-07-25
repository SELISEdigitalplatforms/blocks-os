import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  params: { serviceName: "iam-api", traceId: "trace-9" },
  traceProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@/hooks/use-lmt-base-path", () => ({ useLmtBasePath: () => "/app/lmt" }));
vi.mock("react-router-dom", () => ({ useParams: () => h.params }));
vi.mock("@blocks-lmt/constants/services.constant", () => ({
  SERVICES: [{ name: "iam", label: "IAM", showInLogs: true }],
}));
vi.mock("@blocks-lmt/components/trace-details", () => ({
  TraceDetails: (props: Record<string, unknown>) => {
    h.traceProps = props;
    return <div data-testid="trace" />;
  },
}));

import { LmtServiceLogTraceRoute } from "./service-log-trace";

describe("LmtServiceLogTraceRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.params = { serviceName: "iam-api", traceId: "trace-9" };
  });

  it("renders trace details with the id and computed breadcrumb href", () => {
    render(<LmtServiceLogTraceRoute />);
    expect(screen.getByTestId("trace")).toBeTruthy();
    expect(h.traceProps?.id).toBe("trace-9");
    expect(h.traceProps?.logsTraceBreadcrumbHref).toBe("/app/lmt/logs/iam-api/trace/trace-9");
  });

  it("leaves the breadcrumb href undefined when the trace id is missing", () => {
    h.params = { serviceName: "iam-api", traceId: "" as unknown as string };
    render(<LmtServiceLogTraceRoute />);
    expect(h.traceProps?.id).toBe("");
    expect(h.traceProps?.logsTraceBreadcrumbHref).toBeUndefined();
  });
});
