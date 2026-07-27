import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const saveJWTClaim = vi.fn();
let isLoading = false;
let existingJwtClaim: Record<string, unknown> | undefined;
let isJwtClaimLoading = false;

vi.mock("@blocks-idp/authentication/hooks/use-jwt-claim", () => ({
  useAddJwtClaim: () => ({ mutateAsync: saveJWTClaim, isPending: isLoading }),
  useGetJwtClaim: () => ({ data: existingJwtClaim, isLoading: isJwtClaimLoading }),
}));

const showErrorToast = vi.fn();
const showSuccessToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (...a: unknown[]) => showErrorToast(...a),
  showSuccessToast: (...a: unknown[]) => showSuccessToast(...a),
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

const jwtDecode = vi.fn();
vi.mock("jwt-decode", () => ({ jwtDecode: (...a: unknown[]) => jwtDecode(...a) }));

import MapJwtClaimModal from "./map-jwt-claim-modal";

describe("MapJwtClaimModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isLoading = false;
    existingJwtClaim = undefined;
    isJwtClaimLoading = false;
    jwtDecode.mockReturnValue({ sub: "1", email: "a@b.com", roles: ["admin"] });
    saveJWTClaim.mockResolvedValue({ isSuccess: true });
  });

  it("shows the empty prompt before any JWT is decoded", () => {
    render(<MapJwtClaimModal open onOpenChange={vi.fn()} />);
    expect(screen.getByText("Map JWT Claim")).toBeTruthy();
    expect(
      screen.getByText("Please paste a valid JWT above to view and map its fields."),
    ).toBeTruthy();
  });

  it("validates that a token is required before decoding", async () => {
    const user = userEvent.setup();
    render(<MapJwtClaimModal open onOpenChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Decode" }));
    expect(await screen.findByText("JWT is required.")).toBeTruthy();
  });

  it("decodes a valid JWT and reveals the mapping table", async () => {
    const user = userEvent.setup();
    render(<MapJwtClaimModal open onOpenChange={vi.fn()} />);
    await user.type(screen.getByPlaceholderText("Paste here..."), "header.payload.sig");
    await user.click(screen.getByRole("button", { name: "Decode" }));
    await waitFor(() =>
      expect(showSuccessToast).toHaveBeenCalledWith({
        description: "JWT decoded successfully. You can now update the mapping table.",
      }),
    );
    expect(screen.getByText("JWT Key")).toBeTruthy();
    expect(screen.getByText("User Id")).toBeTruthy();
  });

  it("reports an invalid token when decoding throws", async () => {
    jwtDecode.mockImplementation(() => {
      throw new Error("bad");
    });
    const user = userEvent.setup();
    render(<MapJwtClaimModal open onOpenChange={vi.fn()} />);
    await user.type(screen.getByPlaceholderText("Paste here..."), "garbage");
    await user.click(screen.getByRole("button", { name: "Decode" }));
    expect(await screen.findByText("Invalid JWT Token.")).toBeTruthy();
  });

  it("reports when the decoded token has no properties", async () => {
    jwtDecode.mockReturnValue({});
    const user = userEvent.setup();
    render(<MapJwtClaimModal open onOpenChange={vi.fn()} />);
    await user.type(screen.getByPlaceholderText("Paste here..."), "empty");
    await user.click(screen.getByRole("button", { name: "Decode" }));
    expect(await screen.findByText("Invalid JWT Token: No properties found.")).toBeTruthy();
  });

  it("renders the loading skeleton while the existing claim loads", () => {
    isJwtClaimLoading = true;
    render(<MapJwtClaimModal open onOpenChange={vi.fn()} />);
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it("prefills mapping from an existing claim and saves it", async () => {
    existingJwtClaim = { itemId: "claim-1", userId: "sub", email: "email", name: "", userName: "", roles: "" };
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<MapJwtClaimModal open onOpenChange={onOpenChange} />);
    const save = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    await user.click(save);
    await waitFor(() => expect(saveJWTClaim).toHaveBeenCalledTimes(1));
    expect(saveJWTClaim).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: "claim-1", userId: "sub", email: "email" }),
    );
    expect(showSuccessToast).toHaveBeenCalledWith({ description: "JWT Claim Saved Successfully" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows an error toast when the save fails", async () => {
    existingJwtClaim = { itemId: "claim-1", userId: "sub" };
    saveJWTClaim.mockResolvedValue({ isSuccess: false });
    const user = userEvent.setup();
    render(<MapJwtClaimModal open onOpenChange={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(showErrorToast).toHaveBeenCalledWith({ errors: "Something went wrong!" }),
    );
  });

  it("closes the drawer when Cancel is clicked", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<MapJwtClaimModal open onOpenChange={onOpenChange} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
