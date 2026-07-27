import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  copy: vi.fn(),
  showSuccessToast: vi.fn(),
}));

vi.mock("react-router", () => ({ useNavigate: () => h.navigate }));
vi.mock("@/hooks/use-lmt-base-path", () => ({ useLmtBasePath: () => "/app/proj-1/lmt" }));
vi.mock("@/lib/runtime-env", () => ({ getRuntimeEnv: () => "https://os.example.com" }));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useCopyToClipboard: () => ({ copy: h.copy }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
}));

import { Accordion, AccordionItem } from "@/components/ui-kits/accordion/accordion";
import { ServiceCard } from "./service-card";
import type { RegisteredService } from "@blocks-identifier/models/service.model";

const baseService = {
  serviceId: "svc-123",
  name: "Orders API",
  serviceType: "backend",
  tenantId: "tenant-xyz",
  serviceBusConnectionString: "Endpoint=sb://x",
  description: "Handles orders",
  tags: ["a", "b", "c", "d", "e", "f"],
} as unknown as RegisteredService;

const renderCard = (service: RegisteredService) =>
  render(
    <Accordion type="single" collapsible defaultValue="item">
      <AccordionItem value="item">
        <ServiceCard service={service} />
      </AccordionItem>
    </Accordion>,
  );

describe("ServiceCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.copy.mockImplementation((_v: string, opts?: { onSuccess?: () => void }) => opts?.onSuccess?.());
  });

  it("renders the service name, type badge and copyable ids", () => {
    renderCard(baseService);
    expect(screen.getByText("Orders API")).toBeTruthy();
    expect(screen.getByText("backend")).toBeTruthy();
    expect(screen.getByText("Service ID")).toBeTruthy();
    expect(screen.getByText("Connection String")).toBeTruthy();
    expect(screen.getByText("X-Blocks-Key")).toBeTruthy();
    expect(screen.getByText("Handles orders")).toBeTruthy();
  });

  it("navigates to logs and traces from the quick links", () => {
    renderCard(baseService);
    fireEvent.click(screen.getByText("Logs"));
    expect(h.navigate).toHaveBeenCalledWith(expect.stringContaining("/app/proj-1/lmt/logs"));
    fireEvent.click(screen.getByText("Traces"));
    expect(h.navigate).toHaveBeenCalledWith(expect.stringContaining("/app/proj-1/lmt/tracing"));
  });

  it("copies an id and fires the success toast", () => {
    renderCard(baseService);
    // The copy buttons carry only an icon (no text), unlike the Logs/Traces links.
    const iconOnlyButtons = screen
      .getAllByRole("button")
      .filter((b) => (b.textContent ?? "").trim() === "" && b.querySelector("svg"));
    fireEvent.click(iconOnlyButtons[0]);
    expect(h.copy).toHaveBeenCalled();
    expect(h.showSuccessToast).toHaveBeenCalled();
  });

  it("hides the connection string for frontend services", () => {
    renderCard({ ...baseService, serviceType: "frontend" } as RegisteredService);
    expect(screen.queryByText("Connection String")).toBeNull();
  });

  it("expands the tag list beyond the first four when clicking the overflow badge", () => {
    renderCard(baseService);
    // Six tags -> first four shown plus a "+2" overflow badge.
    expect(screen.getByText("+2")).toBeTruthy();
    expect(screen.queryByText("e")).toBeNull();
    fireEvent.click(screen.getByText("+2"));
    expect(screen.getByText("e")).toBeTruthy();
    expect(screen.getByText("f")).toBeTruthy();
  });
});
