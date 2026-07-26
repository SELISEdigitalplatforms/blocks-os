import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  reducer,
  toast,
  useToast,
  showSuccessToast,
  showInfoToast,
  showErrorToast,
} from "./use-toast";

type State = Parameters<typeof reducer>[0];
type ToastItem = State["toasts"][number];

describe("use-toast reducer", () => {
  it("adds a toast and enforces the toast limit of one", () => {
    let state: State = { toasts: [] };
    state = reducer(state, { type: "ADD_TOAST", toast: { id: "1", open: true } as unknown as ToastItem });
    state = reducer(state, { type: "ADD_TOAST", toast: { id: "2", open: true } as unknown as ToastItem });
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].id).toBe("2");
  });

  it("updates an existing toast", () => {
    let state: State = { toasts: [{ id: "1", title: "old", open: true }] };
    state = reducer(state, { type: "UPDATE_TOAST", toast: { id: "1", title: "new" } });
    expect(state.toasts[0].title).toBe("new");
  });

  it("dismisses a specific toast by closing it", () => {
    let state: State = { toasts: [{ id: "1", open: true }] };
    state = reducer(state, { type: "DISMISS_TOAST", toastId: "1" });
    expect(state.toasts[0].open).toBe(false);
  });

  it("dismisses every toast when no id is given", () => {
    let state: State = { toasts: [{ id: "1", open: true }, { id: "2", open: true }] };
    state = reducer(state, { type: "DISMISS_TOAST" });
    expect(state.toasts.every((t) => t.open === false)).toBe(true);
  });

  it("removes a specific toast", () => {
    let state: State = { toasts: [{ id: "1" }, { id: "2" }] };
    state = reducer(state, { type: "REMOVE_TOAST", toastId: "1" });
    expect(state.toasts).toEqual([{ id: "2" }]);
  });

  it("removes all toasts when no id is given", () => {
    let state: State = { toasts: [{ id: "1" }, { id: "2" }] };
    state = reducer(state, { type: "REMOVE_TOAST", toastId: undefined });
    expect(state.toasts).toEqual([]);
  });
});

describe("useToast hook", () => {
  beforeEach(() => {
    // clear any residual toast from a previous test
    const { result } = renderHook(() => useToast());
    act(() => result.current.dismiss());
  });

  it("exposes the current toasts and reacts to new toasts", async () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast({ title: "Hello", description: "World" });
    });
    await waitFor(() => expect(result.current.toasts[0]?.title).toBe("Hello"));
  });

  it("returns handles allowing update and dismiss", async () => {
    const { result } = renderHook(() => useToast());
    let handle: ReturnType<typeof toast> | undefined;
    act(() => {
      handle = result.current.toast({ title: "First" });
    });
    act(() => handle!.update({ id: handle!.id, title: "Second" } as unknown as ToastItem));
    await waitFor(() => expect(result.current.toasts[0]?.title).toBe("Second"));
    act(() => handle!.dismiss());
    await waitFor(() => expect(result.current.toasts[0]?.open).toBe(false));
  });

  it("closes the toast via onOpenChange(false)", async () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.toast({ title: "Closable" });
    });
    await waitFor(() => expect(result.current.toasts[0]).toBeTruthy());
    act(() => result.current.toasts[0].onOpenChange?.(false));
    await waitFor(() => expect(result.current.toasts[0]?.open).toBe(false));
  });
});

describe("toast helpers", () => {
  it("showSuccessToast pushes a success variant", async () => {
    const { result } = renderHook(() => useToast());
    act(() => showSuccessToast({ description: "done" }));
    await waitFor(() => {
      expect(result.current.toasts[0]?.variant).toBe("success");
      expect(result.current.toasts[0]?.title).toBe("Success");
    });
  });

  it("showInfoToast pushes an info variant", async () => {
    const { result } = renderHook(() => useToast());
    act(() => showInfoToast({ description: "fyi" }));
    await waitFor(() => expect(result.current.toasts[0]?.variant).toBe("info"));
  });

  it("showErrorToast pushes a destructive variant from an error", async () => {
    const { result } = renderHook(() => useToast());
    act(() => showErrorToast({ errors: new Error("bad"), title: "Nope" }));
    await waitFor(() => {
      expect(result.current.toasts[0]?.variant).toBe("destructive");
      expect(result.current.toasts[0]?.title).toBe("Nope");
    });
  });

  it("showErrorToast renders a list when several messages are returned", async () => {
    const { result } = renderHook(() => useToast());
    act(() =>
      showErrorToast({ errors: { field1: "e1", field2: "e2" } as unknown as Record<string, string> }),
    );
    await waitFor(() => expect(result.current.toasts[0]?.variant).toBe("destructive"));
  });
});
