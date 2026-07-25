import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./markdown-components-map", () => ({ MarkdownComponentsMap: {} }));

import { MarkdownRenderer } from "./markdown-renderer";

describe("MarkdownRenderer", () => {
  it("renders plain markdown when there are no embedded json blocks", () => {
    render(<MarkdownRenderer content={"# Title\n\nHello world"} />);
    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getByText("Hello world")).toBeTruthy();
  });

  it("pretty-prints a valid embedded json block", () => {
    const content = "Intro line\n\n:::json\n{\"a\":1,\"b\":2}\n:::\n\nOutro line";
    const { container } = render(<MarkdownRenderer content={content} />);
    // surrounding markdown is still rendered
    expect(screen.getByText("Intro line")).toBeTruthy();
    expect(screen.getByText("Outro line")).toBeTruthy();
    // JSON is reformatted with indentation
    expect(container.textContent).toContain('"a": 1');
    expect(container.textContent).toContain('"b": 2');
  });

  it("falls back to the raw text when the json block is invalid", () => {
    const content = ":::json\nnot-valid-json\n:::";
    const { container } = render(<MarkdownRenderer content={content} />);
    expect(container.textContent).toContain("not-valid-json");
  });

  it("renders a json-skeleton block with its raw content", () => {
    const content = ":::json-skeleton\n{\"loading\":true}\n:::";
    const { container } = render(<MarkdownRenderer content={content} />);
    expect(container.textContent).toContain('"loading":true');
  });

  it("applies an extra className to the wrapper", () => {
    const { container } = render(
      <MarkdownRenderer content="plain" className="custom-class" />,
    );
    expect(container.querySelector(".custom-class")).toBeTruthy();
  });
});
