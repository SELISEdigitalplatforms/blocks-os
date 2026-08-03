import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  preSigned: vi.fn(),
  upload: vi.fn(),
  updateUser: vi.fn(),
  getFileByFileId: vi.fn(),
  invalidateQueries: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  userByIdData: { data: { profileImageUrl: "" } } as unknown,
}));

vi.mock("@blocks-storage/hooks/use-storage-file", () => ({
  useGetPreSignedUrlForUpload: () => ({ mutateAsync: h.preSigned }),
  useUploadFile: () => ({ mutateAsync: h.upload }),
}));
vi.mock("@blocks-storage/services/storage.service", () => ({
  storageService: { file: { getFileByFileId: (...a: unknown[]) => h.getFileByFileId(...a) } },
}));
vi.mock("@blocks-idp/iam/hooks/use-user", () => ({
  useGetUserById: () => ({ data: h.userByIdData }),
  useUpdateUser: () => ({ mutateAsync: h.updateUser }),
}));
vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: (a: unknown) => h.showError(a),
  showSuccessToast: (a: unknown) => h.showSuccess(a),
}));
// Mirrors the real hook's contract: no url means no image source.
vi.mock("./use-profile-image-src", () => ({
  useProfileImageSrc: (url?: string | null) => url || null,
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: h.invalidateQueries }),
}));

import { ProfileImageUploader } from "./profile-image-uploader";

const makeFile = (type: string, sizeBytes = 10) => {
  const file = new File([new Uint8Array(sizeBytes)], "avatar.png", { type });
  return file;
};

beforeEach(() => {
  vi.clearAllMocks();
  h.userByIdData = { data: { profileImageUrl: "" } };
  Object.defineProperty(URL, "createObjectURL", { value: () => "blob:preview", configurable: true });
});

describe("ProfileImageUploader", () => {
  it("renders the profile image with the change-image button", () => {
    render(<ProfileImageUploader projectKey="p1" id="u1" />);
    expect(screen.getByAltText("Profile Image")).toBeTruthy();
    expect(screen.getByLabelText("Change profile image")).toBeTruthy();
  });

  it("rejects a non-image file with an error toast", () => {
    const { container } = render(<ProfileImageUploader projectKey="p1" id="u1" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("application/pdf")] } });
    expect(h.showError).toHaveBeenCalledWith({
      errors: "Only image files (PNG, JPG, GIF, WebP, and SVG) are allowed",
    });
    expect(h.preSigned).not.toHaveBeenCalled();
  });

  it("uploads a valid image and shows a success toast", async () => {
    h.preSigned.mockResolvedValue({ isSuccess: true, fileId: "f1", uploadUrl: "https://up" });
    h.upload.mockResolvedValue(undefined);
    h.getFileByFileId.mockResolvedValue({ itemId: "f1", url: "https://cdn/img.png" });
    h.updateUser.mockResolvedValue({ isSuccess: true });
    const { container } = render(<ProfileImageUploader projectKey="p1" id="u1" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("image/png")] } });
    await waitFor(() => expect(h.preSigned).toHaveBeenCalled());
    await waitFor(() => expect(h.upload).toHaveBeenCalledWith({ url: "https://up", file: expect.any(File) }));
    await waitFor(() => expect(h.updateUser).toHaveBeenCalled());
    await waitFor(() => expect(h.showSuccess).toHaveBeenCalled());
    expect(h.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["user"] });
  });

  it("falls back to the placeholder photo when the user has no profile image", () => {
    render(<ProfileImageUploader projectKey="p1" id="u1" />);
    expect(screen.getByAltText("Profile Image").getAttribute("src")).toBe(
      "/assets/images/empty-profile-photo.png",
    );
  });

  it("renders the stored profile image when the user has one", () => {
    h.userByIdData = { data: { profileImageUrl: "https://cdn/stored.png" } };
    render(<ProfileImageUploader projectKey="p1" id="u1" />);
    expect(screen.getByAltText("Profile Image").getAttribute("src")).toBe(
      "https://cdn/stored.png",
    );
  });

  it("opens the hidden file picker when the change-image button is pressed", () => {
    const { container } = render(<ProfileImageUploader projectKey="p1" id="u1" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const click = vi.spyOn(input, "click").mockImplementation(() => {});
    fireEvent.click(screen.getByLabelText("Change profile image"));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the picker closes without a file", () => {
    const { container } = render(<ProfileImageUploader projectKey="p1" id="u1" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(h.showError).not.toHaveBeenCalled();
    expect(h.preSigned).not.toHaveBeenCalled();
  });

  it("rejects an image larger than 5MB with an error toast", () => {
    const { container } = render(<ProfileImageUploader projectKey="p1" id="u1" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [makeFile("image/png", 5 * 1024 * 1024 + 1)] },
    });
    expect(h.showError).toHaveBeenCalledWith({ errors: "File size must be less than 5MB" });
    expect(h.preSigned).not.toHaveBeenCalled();
    expect(input.value).toBe("");
  });

  it("stops silently when the pre-signed upload url cannot be issued", async () => {
    h.preSigned.mockResolvedValue({ isSuccess: false });
    const { container } = render(<ProfileImageUploader projectKey="p1" id="u1" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("image/png")] } });
    await waitFor(() => expect(h.preSigned).toHaveBeenCalled());
    expect(h.upload).not.toHaveBeenCalled();
    expect(h.showSuccess).not.toHaveBeenCalled();
    expect(h.showError).not.toHaveBeenCalled();
  });

  it("surfaces the server errors when the upload throws with an errors payload", async () => {
    h.preSigned.mockRejectedValue({ errors: { file: "rejected" } });
    const { container } = render(<ProfileImageUploader projectKey="p1" id="u1" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("image/png")] } });
    await waitFor(() =>
      expect(h.showError).toHaveBeenCalledWith({ errors: { file: "rejected" } }),
    );
  });

  it("shows a generic error toast when the upload throws a plain error", async () => {
    h.preSigned.mockRejectedValue(new Error("network down"));
    const { container } = render(<ProfileImageUploader projectKey="p1" id="u1" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("image/png")] } });
    await waitFor(() =>
      expect(h.showError).toHaveBeenCalledWith({ errors: "Something went wrong" }),
    );
  });

  it("shows an error toast when the user update fails", async () => {
    h.preSigned.mockResolvedValue({ isSuccess: true, fileId: "f1", uploadUrl: "https://up" });
    h.upload.mockResolvedValue(undefined);
    h.getFileByFileId.mockResolvedValue({ itemId: "f1", url: "https://cdn/img.png" });
    h.updateUser.mockResolvedValue({ isSuccess: false, errors: "update failed" });
    const { container } = render(<ProfileImageUploader projectKey="p1" id="u1" />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeFile("image/png")] } });
    await waitFor(() => expect(h.showError).toHaveBeenCalledWith({ errors: "update failed" }));
  });
});
