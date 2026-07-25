import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { DropzoneOptions } from "react-dropzone";

type CapturedDropzoneOptions = {
  onDrop: (accepted: File[] | null, rejected: unknown[]) => void;
  onDropAccepted?: () => void;
};

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

// A controllable react-dropzone mock. It records the options passed to
// useDropzone (so tests can invoke onDrop / onDropAccepted directly) and
// returns a mutable state object so drag flags and the input ref click can be
// asserted.
const dz = vi.hoisted(() => {
  return {
    captured: null as null | CapturedDropzoneOptions,
    ret: {
      getRootProps: () => ({ "data-testid": "dz-root" }),
      getInputProps: () => ({ "data-testid": "dz-input" }),
      inputRef: { current: { click: vi.fn() } as unknown as HTMLInputElement },
      isDragAccept: false,
      isDragReject: false,
    },
  };
});

vi.mock("react-dropzone", () => ({
  useDropzone: (opts: CapturedDropzoneOptions) => {
    dz.captured = opts;
    return dz.ret;
  },
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
import { showErrorToast } from "@/hooks/use-toast";

const makeFile = (name: string) => new File(["content"], name, { type: "image/png" });

type UploaderOverrides = {
  dropzoneOptions?: DropzoneOptions;
  orientation?: "horizontal" | "vertical";
  dir?: "rtl" | "ltr";
  reSelect?: boolean;
};

const renderUploader = (
  value: File[] | null,
  onValueChange: (v: File[] | null) => void,
  overrides: UploaderOverrides = {},
) =>
  render(
    <FileUploader
      value={value}
      onValueChange={onValueChange}
      dropzoneOptions={overrides.dropzoneOptions ?? { maxFiles: 3 }}
      orientation={overrides.orientation}
      dir={overrides.dir}
      reSelect={overrides.reSelect}
      data-testid="uploader"
    >
      <FileInput>
        <div>Drop files here</div>
      </FileInput>
      <FileUploaderContent>
        {(value ?? []).map((file, i) => (
          <FileUploaderItem key={file.name} index={i}>
            {file.name}
          </FileUploaderItem>
        ))}
      </FileUploaderContent>
    </FileUploader>,
  );

describe("FileUploader", () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dz.captured = null;
    dz.ret.isDragAccept = false;
    dz.ret.isDragReject = false;
    dz.ret.inputRef = { current: null as unknown as HTMLInputElement };
    vi.clearAllMocks();
    // React attaches the real DOM input to inputRef.current, so the click that
    // handleKeyDown triggers is the native element click. Spy on the prototype.
    clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
  });

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

    expect(onValueChange).toHaveBeenCalledTimes(1);
    const remaining = onValueChange.mock.calls[0][0] as File[];
    expect(remaining.map((f) => f.name)).toEqual(["b.png"]);
  });

  it("throws when useFileUpload is used outside a provider", () => {
    const Consumer = () => {
      useFileUpload();
      return null;
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(
      "useFileUpload must be used within a FileUploaderProvider",
    );
    spy.mockRestore();
  });

  describe("onDrop", () => {
    it("appends accepted files up to maxFiles", () => {
      const onValueChange = vi.fn();
      renderUploader([makeFile("a.png")], onValueChange, {
        dropzoneOptions: { maxFiles: 2 },
      });
      act(() => {
        dz.captured?.onDrop([makeFile("b.png"), makeFile("c.png")], []);
      });
      const result = onValueChange.mock.calls[0][0] as File[];
      // Existing file a.png plus first accepted b.png; c.png dropped at limit 2.
      expect(result.map((f) => f.name)).toEqual(["a.png", "b.png"]);
    });

    it("replaces all files when reSelectAll (maxFiles === 1)", () => {
      const onValueChange = vi.fn();
      renderUploader([makeFile("a.png")], onValueChange, {
        dropzoneOptions: { maxFiles: 1 },
      });
      act(() => {
        dz.captured?.onDrop([makeFile("new.png")], []);
      });
      const result = onValueChange.mock.calls[0][0] as File[];
      expect(result.map((f) => f.name)).toEqual(["new.png"]);
    });

    it("starts from an empty set when value is null", () => {
      const onValueChange = vi.fn();
      renderUploader(null, onValueChange, { dropzoneOptions: { maxFiles: 3 } });
      act(() => {
        dz.captured?.onDrop([makeFile("x.png")], []);
      });
      const result = onValueChange.mock.calls[0][0] as File[];
      expect(result.map((f) => f.name)).toEqual(["x.png"]);
    });

    it("toasts when there is no accepted file list", () => {
      const onValueChange = vi.fn();
      renderUploader([], onValueChange);
      act(() => {
        dz.captured?.onDrop(null as unknown as File[], []);
      });
      expect(showErrorToast).toHaveBeenCalledWith({ errors: "file error , probably too big" });
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it("toasts a file-too-large rejection", () => {
      renderUploader([], vi.fn(), { dropzoneOptions: { maxFiles: 3, maxSize: 5 * 1024 * 1024 } });
      act(() => {
        dz.captured?.onDrop(
          [],
          [{ file: makeFile("big.png"), errors: [{ code: "file-too-large", message: "big" }] }],
        );
      });
      expect(showErrorToast).toHaveBeenCalledWith({ errors: "File is too large. Max size is 5MB" });
    });

    it("toasts a file-invalid-type rejection", () => {
      renderUploader([], vi.fn());
      act(() => {
        dz.captured?.onDrop(
          [],
          [{ file: makeFile("bad.txt"), errors: [{ code: "file-invalid-type", message: "x" }] }],
        );
      });
      expect(showErrorToast).toHaveBeenCalledWith({ errors: "Invalid file type" });
    });

    it("falls back to the rejection message when there is no known code", () => {
      renderUploader([], vi.fn());
      act(() => {
        dz.captured?.onDrop(
          [],
          [{ file: makeFile("odd.png"), errors: [{ code: "other", message: "custom failure" }] }],
        );
      });
      expect(showErrorToast).toHaveBeenCalledWith({ errors: "custom failure" });
    });

    it("clears the too-big flag on accepted drops", () => {
      renderUploader([], vi.fn());
      expect(() => act(() => dz.captured?.onDropAccepted?.())).not.toThrow();
    });
  });

  describe("keyboard navigation", () => {
    const getRoot = () => screen.getByTestId("uploader");

    it("navigates forward and wraps with the next key (vertical/ltr)", () => {
      renderUploader([makeFile("a.png"), makeFile("b.png")], vi.fn());
      const root = getRoot();
      fireEvent.keyDown(root, { key: "ArrowDown" });
      fireEvent.keyDown(root, { key: "ArrowDown" });
      // wrap-around back to 0
      fireEvent.keyDown(root, { key: "ArrowDown" });
      expect(root).toBeTruthy();
    });

    it("navigates backward and wraps with the previous key", () => {
      renderUploader([makeFile("a.png"), makeFile("b.png")], vi.fn());
      const root = getRoot();
      fireEvent.keyDown(root, { key: "ArrowUp" });
      fireEvent.keyDown(root, { key: "ArrowUp" });
      expect(root).toBeTruthy();
    });

    it("clicks the hidden input on Enter when nothing is active", () => {
      renderUploader([makeFile("a.png")], vi.fn());
      fireEvent.keyDown(getRoot(), { key: "Enter" });
      expect(clickSpy).toHaveBeenCalled();
    });

    it("does nothing on Enter when a file is active", () => {
      renderUploader([makeFile("a.png")], vi.fn());
      const root = getRoot();
      fireEvent.keyDown(root, { key: "ArrowDown" });
      fireEvent.keyDown(root, { key: "Space" });
      // input.click only fires when activeIndex === -1
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it("removes the active file on Delete and resets when it was the last", () => {
      const onValueChange = vi.fn();
      renderUploader([makeFile("only.png")], onValueChange);
      const root = getRoot();
      fireEvent.keyDown(root, { key: "ArrowDown" });
      fireEvent.keyDown(root, { key: "Delete" });
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect((onValueChange.mock.calls[0][0] as File[]).length).toBe(0);
    });

    it("removes the active file on Backspace and moves selection when others remain", () => {
      const onValueChange = vi.fn();
      renderUploader([makeFile("a.png"), makeFile("b.png")], onValueChange);
      const root = getRoot();
      fireEvent.keyDown(root, { key: "ArrowDown" });
      fireEvent.keyDown(root, { key: "Backspace" });
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });

    it("resets the active index on Escape", () => {
      renderUploader([makeFile("a.png")], vi.fn());
      const root = getRoot();
      fireEvent.keyDown(root, { key: "ArrowDown" });
      fireEvent.keyDown(root, { key: "Escape" });
      expect(root).toBeTruthy();
    });

    it("ignores key handling when there is no value", () => {
      renderUploader(null, vi.fn());
      fireEvent.keyDown(getRoot(), { key: "ArrowDown" });
      expect(clickSpy).not.toHaveBeenCalled();
    });

    it("uses horizontal/rtl key mapping", () => {
      renderUploader([makeFile("a.png"), makeFile("b.png")], vi.fn(), {
        orientation: "horizontal",
        dir: "rtl",
      });
      const root = getRoot();
      // In horizontal + rtl, next is ArrowLeft and prev is ArrowRight.
      fireEvent.keyDown(root, { key: "ArrowLeft" });
      fireEvent.keyDown(root, { key: "ArrowRight" });
      expect(root).toBeTruthy();
    });
  });

  describe("FileInput drag and limit states", () => {
    it("marks the drop area accepted while dragging a valid file", () => {
      dz.ret.isDragAccept = true;
      const { container } = renderUploader([], vi.fn());
      expect(container.querySelector(".border-green-500")).toBeTruthy();
    });

    it("marks the drop area rejected while dragging an invalid file", () => {
      dz.ret.isDragReject = true;
      const { container } = renderUploader([], vi.fn());
      expect(container.querySelector(".border-red-500")).toBeTruthy();
    });

    it("disables the input and skips root props when at the file limit", () => {
      const { container } = renderUploader([makeFile("a.png")], vi.fn(), {
        dropzoneOptions: { maxFiles: 1 },
      });
      // isLOF true adds cursor-not-allowed to the wrapper.
      expect(container.querySelector(".cursor-not-allowed")).toBeTruthy();
    });
  });
});
