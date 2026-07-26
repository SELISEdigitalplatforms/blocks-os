import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
  formProps: undefined as unknown,
}));

vi.mock("@/hooks/use-project", () => ({
  useUpdateRepositories: () => ({ mutateAsync: h.mutateAsync, isPending: h.isPending }),
}));
vi.mock("@seliseblocks/blocks-kit/utils", () => ({
  showErrorToast: (...a: unknown[]) => h.showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => h.showSuccessToast(...a),
}));
// Isolate the inner form; capture the props the dialog computes for it.
vi.mock("./form", () => ({
  SetCustomDomainForm: (props: Record<string, unknown>) => {
    h.formProps = props;
    return (
      <div>
        <span data-testid="default-domain">{String(props.defaultDomain)}</span>
        <span data-testid="verified-count">
          {(props.verifiedDomains as string[]).length}
        </span>
        <button onClick={() => (props.onSubmit as (d: string) => void)("new.example.com")}>
          submit
        </button>
        <button onClick={() => (props.onCancel as () => void)()}>cancel</button>
      </div>
    );
  },
}));

import { SetCustomDomainDialog } from "./dialog";

const domains = [
  { domain: "app.example.com", isDomainVerified: true },
  { domain: "app.example.com", isDomainVerified: true },
  { domain: "unverified.example.com", isDomainVerified: false },
  { domain: "other.example.com", isDomainVerified: true },
] as never[];

const repo = {
  itemId: "repo-1",
  repoName: "web",
  repoUrl: "https://git/web",
  customDeploymentUrl: "https://App.Example.com/",
} as never;

const renderDialog = (over: Record<string, unknown> = {}) => {
  const onOpenChange = vi.fn();
  render(
    <SetCustomDomainDialog
      open
      onOpenChange={onOpenChange}
      repo={repo}
      domains={domains}
      projectKey="tenant-1"
      projectEnv="dev"
      {...over}
    />,
  );
  return { onOpenChange };
};

describe("SetCustomDomainDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.isPending = false;
    h.mutateAsync.mockResolvedValue({ isSuccess: true });
  });

  it("dedupes verified domains and preselects the repo's normalized current url", () => {
    renderDialog();
    // Only verified, deduped -> app.example.com + other.example.com
    expect(screen.getByTestId("verified-count").textContent).toBe("2");
    // Matches despite protocol/case/trailing-slash differences.
    expect(screen.getByTestId("default-domain").textContent).toBe("app.example.com");
    expect(screen.getByText("web")).toBeTruthy();
  });

  it("submits the chosen domain and reports success then closes", async () => {
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByText("submit"));
    await waitFor(() => expect(h.mutateAsync).toHaveBeenCalled());
    expect(h.mutateAsync.mock.calls[0][0]).toMatchObject({
      projectKey: "tenant-1",
      projectEnv: "dev",
    });
    expect(h.showSuccessToast).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows an error toast when the update fails", async () => {
    h.mutateAsync.mockResolvedValueOnce({ isSuccess: false, errors: { general: "no" } });
    renderDialog();
    fireEvent.click(screen.getByText("submit"));
    await waitFor(() => expect(h.showErrorToast).toHaveBeenCalled());
  });

  it("falls back to no preselection when the repo url does not match a verified domain", () => {
    renderDialog({ repo: { ...repo, customDeploymentUrl: "https://missing.example.com" } });
    expect(screen.getByTestId("default-domain").textContent).toBe("");
  });
});
