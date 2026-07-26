import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from "./breadcrumb";

describe("Breadcrumb", () => {
  it("renders a full breadcrumb trail", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/home">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Current</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );
    expect(screen.getByLabelText("breadcrumb")).toBeTruthy();
    const link = screen.getByText("Home");
    expect(link.getAttribute("href")).toBe("/home");
    const current = screen.getByText("Current");
    expect(current.getAttribute("aria-current")).toBe("page");
  });

  it("renders a link as a child element when asChild is set", () => {
    render(
      <BreadcrumbLink asChild>
        <button type="button">As button</button>
      </BreadcrumbLink>,
    );
    const el = screen.getByRole("button", { name: "As button" });
    expect(el.className).toContain("transition-colors");
  });

  it("renders custom separator content", () => {
    render(<BreadcrumbSeparator>/</BreadcrumbSeparator>);
    expect(screen.getByText("/")).toBeTruthy();
  });

  it("renders the ellipsis with an accessible label", () => {
    render(<BreadcrumbEllipsis />);
    expect(screen.getByText("More")).toBeTruthy();
  });
});
