import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from "./toast";

const renderToast = (variant?: "default" | "destructive" | "success" | "warning" | "info") =>
  render(
    <ToastProvider>
      <Toast open variant={variant}>
        <ToastTitle>Saved</ToastTitle>
        <ToastDescription>Your changes were saved</ToastDescription>
        <ToastAction altText="undo">Undo</ToastAction>
        <ToastClose />
      </Toast>
      <ToastViewport />
    </ToastProvider>,
  );

describe("Toast", () => {
  it("renders the title, description and action", () => {
    renderToast();
    expect(screen.getByText("Saved")).toBeTruthy();
    expect(screen.getByText("Your changes were saved")).toBeTruthy();
    expect(screen.getByText("Undo")).toBeTruthy();
  });

  it("applies the success variant styling", () => {
    renderToast("success");
    const toast = screen.getByText("Saved").closest("[data-state]") as HTMLElement;
    expect(toast.className).toContain("border-green-500");
  });

  it("applies the destructive variant styling", () => {
    renderToast("destructive");
    const toast = screen.getByText("Saved").closest("[data-state]") as HTMLElement;
    expect(toast.className).toContain("border-destructive");
  });

  it("renders a close control", () => {
    const { container } = renderToast("warning");
    expect(container.querySelector("[toast-close]")).toBeTruthy();
  });
});
