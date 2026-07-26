import { render, screen, fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  providers: [] as unknown[],
  seedModels: [] as unknown[],
  isSeedLoading: false,
  models: undefined as unknown,
  isModelsLoading: false,
  isModelsFetching: false,
  setQueryParams: vi.fn(),
  queryParams: { search: "", page: 1, page_size: 10 },
  addKeyProps: undefined as Record<string, unknown> | undefined,
  customModalProps: undefined as Record<string, unknown> | undefined,
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => h.navigate }));
vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useScopedPath: () => (p: string) => `/app/proj/${p}`,
}));
vi.mock("@blocks-ai/hooks/use-aimodel", () => ({
  useSeedProviders: () => ({ data: h.providers }),
  useSeedModelsByProvider: () => ({ data: h.seedModels, isLoading: h.isSeedLoading }),
  useGetModels: () => ({
    data: h.models,
    isLoading: h.isModelsLoading,
    isFetching: h.isModelsFetching,
  }),
  useAIModelsQueryParams: () => ({ queryParams: h.queryParams, setQueryParams: h.setQueryParams }),
}));
vi.mock("@blocks-ai/components/aimodels/aimodel-table/aimodel-table", () => ({
  AIModelsTable: () => <div data-testid="models-table" />,
}));
vi.mock("@blocks-ai/components/aimodels/aimodel-selectedpage-filter-toolbar/aimodel-selectedpage-filter-toolbar", () => ({
  AIModelsSelectedPageFilterToolbar: () => <div data-testid="filter-toolbar" />,
}));
vi.mock("@blocks-ai/components/aimodels/modals/aimodel-addkey-modal/aimodel-addkey-modal", () => ({
  ModelAddKeyModal: (props: Record<string, unknown>) => {
    h.addKeyProps = props;
    return <div data-testid="add-key-modal">{String(props.addKeyModalOpen)}</div>;
  },
}));
vi.mock("@blocks-ai/components/aimodels/modals/aimodel-addkey-modal-custom/aimodel-addkey-modal-custom", () => ({
  CustomModelAddKeyModal: (props: Record<string, unknown>) => {
    h.customModalProps = props;
    return <div data-testid="custom-add-key-modal">{String(props.addKeyModalOpen)}</div>;
  },
}));

import { AIModelSelectedPage } from "./aimodel-selected";

describe("AIModelSelectedPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.providers = [{ Provider: "openai", Description: "OpenAI provider" }];
    h.seedModels = [{ Model: "gpt-4", ModelGoodName: "GPT-4", DefaultBaseUrl: "https://api" }];
    h.isSeedLoading = false;
    h.models = { models: [], total: 0, page: 1 };
    h.isModelsLoading = false;
    h.isModelsFetching = false;
    h.queryParams = { search: "", page: 1, page_size: 10 };
  });

  it("renders the provider header, description and models table", () => {
    render(<AIModelSelectedPage provider="openai" />);
    expect(screen.getByText("OpenAI provider")).toBeTruthy();
    expect(screen.getByTestId("models-table")).toBeTruthy();
    expect(screen.getByTestId("filter-toolbar")).toBeTruthy();
  });

  it("navigates back to the models list", () => {
    render(<AIModelSelectedPage provider="openai" />);
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(h.navigate).toHaveBeenCalledWith("/app/proj/secret-management/ai-models");
  });

  it("opens the standard add-key modal for a non-custom provider", () => {
    render(<AIModelSelectedPage provider="openai" />);
    expect(screen.getByTestId("add-key-modal")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Add Model/ }));
    expect(screen.getByTestId("add-key-modal").textContent).toBe("true");
    expect(h.addKeyProps?.baseUrl).toBe("https://api");
  });

  it("renders the custom modal for the custom provider", () => {
    render(<AIModelSelectedPage provider="custom" />);
    expect(screen.getByTestId("custom-add-key-modal")).toBeTruthy();
    expect(screen.queryByTestId("add-key-modal")).toBeNull();
  });

  it("shows pagination when the total exceeds the page size", () => {
    h.models = { models: [{}], total: 25, page: 1 };
    render(<AIModelSelectedPage provider="openai" />);
    // Pagination renders its controls once total > page_size.
    expect(screen.getByText("Rows per page")).toBeTruthy();
    expect(screen.getByText(/Page 1 of/)).toBeTruthy();
  });
});
