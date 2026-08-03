import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  providers: [] as unknown[],
  isLoading: false,
  queryParams: { search: "", types: [] as string[] },
  listProps: [] as Array<Record<string, unknown>>,
}));

vi.mock("@blocks-ai/hooks/use-aimodel", () => ({
  useSeedProviders: () => ({ data: h.providers, isLoading: h.isLoading }),
  useAIModelsQueryParams: () => ({ queryParams: h.queryParams }),
}));
vi.mock("@blocks-ai/components/aimodels/aimodel-filter-toolbar/aimodel-filter-toolbar", () => ({
  AIModelsFilterToolbar: () => <div data-testid="filter-toolbar" />,
}));
vi.mock("./ai-models-list", () => ({
  AiModelsList: (props: Record<string, unknown>) => {
    h.listProps.push(props);
    return (
      <div data-testid={`list-${props.servicePlatform}`}>
        {(props.providerList as Array<{ Provider: string }>).map((p) => p.Provider).join(",")}
      </div>
    );
  },
}));

import { AIModels } from "./ai-models";

describe("AIModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.listProps = [];
    h.isLoading = false;
    h.queryParams = { search: "", types: [] };
    // openai maps to OFFICIAL_API; azure to a platform (open deployment).
    h.providers = [
      { Provider: "openai", Description: "OpenAI" },
      { Provider: "azure", Description: "Azure" },
    ];
  });

  it("renders both official and open deployment lists by default", () => {
    render(<AIModels />);
    expect(screen.getByTestId("filter-toolbar")).toBeTruthy();
    expect(screen.getByTestId("list-Official API")).toBeTruthy();
    expect(screen.getByTestId("list-Open Deployment")).toBeTruthy();
  });

  it("shows skeletons while providers load", () => {
    h.isLoading = true;
    render(<AIModels />);
    expect(screen.getByText("Official API")).toBeTruthy();
    expect(screen.getByText("Open Deployment")).toBeTruthy();
    expect(screen.queryByTestId("list-Official API")).toBeNull();
  });

  it("shows only the official list when the official type filter is active", () => {
    h.queryParams = { search: "", types: ["official"] };
    render(<AIModels />);
    expect(screen.getByTestId("list-Official API")).toBeTruthy();
    expect(screen.queryByTestId("list-Open Deployment")).toBeNull();
  });

  it("filters providers by the search term", () => {
    h.queryParams = { search: "openai", types: [] };
    render(<AIModels />);
    const official = screen.getByTestId("list-Official API");
    expect(official.textContent).toContain("openai");
    // The open-deployment list has no provider matching the search.
    expect(screen.getByTestId("list-Open Deployment").textContent).not.toContain("azure");
  });
});
