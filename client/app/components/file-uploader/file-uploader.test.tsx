import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("matchMedia", (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

vi.mock("react-dropzone", () => ({
  useDropzone: () => ({
    getRootProps: () => ({}),
    getInputProps: () => ({}),
    inputRef: { current: null },
    isDragAccept: false,
    isDragReject: false,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  showErrorToast: vi.fn(),
  showSuccessToast: vi.fn(),
  showInfoToast: vi.fn(),
  useToast: () => ({ toast: vi.fn(), dismiss: vi.fn(), toasts: [] }),
}));

import {
  FileUploader,
  FileUploaderContent,
  FileUploaderItem,
  FileInput,
  useFileUpload,
} from "./file-uploader";

const makeFile = (name: string) => new File(["content"], name, { type: "image/png" });

const renderUploader = (
  value: File[],
  onValueChange: (v: File[] | null) => void,
) =>
  render(
    <FileUploader value={value} onValueChange={onValueChange} dropzoneOptions={{ maxFiles: 3 }}>
      <FileInput>
        <div>Drop files here</div>
      </FileInput>
      <FileUploaderContent>
        {value.map((file, i) => (
          <FileUploaderItem key={file.name} index={i}>
            {file.name}
          </FileUploaderItem>
        ))}
      </FileUploaderContent>
    </FileUploader>,
  );

describe("FileUploader", () => {
  it("renders the drop area and the current file list", () => {
    renderUploader([makeFile("a.png"), makeFile("b.png")], vi.fn());
    expect(screen.getByText("Drop files here")).toBeTruthy();
    expect(screen.getByText("a.png")).toBeTruthy();
    expect(screen.getByText("b.png")).toBeTruthy();
  });

  it("removes a file via the item's remove button", async () => {
    const onValueChange = vi.fn();
    const user = userEvent.setup();
    renderUploader([makeFile("a.png"), makeFile("b.png")], onValueChange);

    await user.click(screen.getByRole("button", { name: "remove item 0" }));

    // removeFileFromSet filters out index 0, leaving only b.png.
    expect(onValueChange).toHaveBeenCalledTimes(1);
    const remaining = onValueChange.mock.calls[0][0] as File[];
    expect(remaining.map((f) => f.name)).toEqual(["b.png"]);
  });

  it("throws when useFileUpload is used outside a provider", () => {
    const Consumer = () => {
      useFileUpload();
      return null;
    };
    // Silence the expected React error boundary logging.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(
      "useFileUpload must be used within a FileUploaderProvider",
    );
    spy.mockRestore();
  });
});
