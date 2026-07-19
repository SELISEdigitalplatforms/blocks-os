import { describe, expect, it } from "vitest";
import { getSettingsTabQueryState } from "./use-settings-tab-query";

describe("getSettingsTabQueryState", () => {
  it("shows the loader while the query is pending", () => {
    const state = getSettingsTabQueryState({
      data: undefined,
      isPending: true,
      isError: false,
    });
    expect(state).toEqual({
      data: undefined,
      showLoader: true,
      showError: false,
    });
  });

  it("passes data through and clears loader/error once resolved", () => {
    const data = { value: 42 };
    const state = getSettingsTabQueryState({
      data,
      isPending: false,
      isError: false,
    });
    expect(state.data).toBe(data);
    expect(state.showLoader).toBe(false);
    expect(state.showError).toBe(false);
  });

  it("surfaces an error when the query errored", () => {
    const state = getSettingsTabQueryState({
      data: undefined,
      isPending: false,
      isError: true,
    });
    expect(state.showError).toBe(true);
  });

  it("treats a settled query with null data as an error", () => {
    const state = getSettingsTabQueryState({
      data: null,
      isPending: false,
      isError: false,
    });
    expect(state.showError).toBe(true);
  });

  it("does not flag an error for null data while still pending", () => {
    const state = getSettingsTabQueryState({
      data: null,
      isPending: true,
      isError: false,
    });
    expect(state.showError).toBe(false);
    expect(state.showLoader).toBe(true);
  });
});
