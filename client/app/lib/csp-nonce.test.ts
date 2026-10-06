// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { getCspNonce, withStyleNonce } from "./csp-nonce";

const addMeta = (nonce: string) => {
  const meta = document.createElement("meta");
  meta.setAttribute("name", "csp-nonce");
  meta.setAttribute("nonce", nonce);
  document.head.appendChild(meta);
};

describe("getCspNonce", () => {
  afterEach(() => {
    document.head.querySelectorAll('meta[name="csp-nonce"]').forEach((m) => m.remove());
  });

  it("returns the nonce the server wrote into the meta tag", () => {
    addMeta("r4nd0m+Nonce/w==");
    expect(getCspNonce()).toBe("r4nd0m+Nonce/w==");
  });

  it("returns an empty string when there is no meta tag", () => {
    expect(getCspNonce()).toBe("");
  });

  it("ignores the unreplaced build placeholder", () => {
    addMeta("__CSP_STYLE_NONCE__");
    expect(getCspNonce()).toBe("");
  });
});

describe("withStyleNonce", () => {
  it("stamps the nonce on every style element", () => {
    const html = '<head><style>a{}</style></head><body><STYLE media="x">b{}</STYLE></body>';
    expect(withStyleNonce(html, "abc")).toBe(
      '<head><style nonce="abc">a{}</style></head><body><style nonce="abc" media="x">b{}</STYLE></body>',
    );
  });

  it("leaves a style that already has a nonce alone", () => {
    expect(withStyleNonce('<style nonce="x">a{}</style>', "abc")).toBe(
      '<style nonce="x">a{}</style>',
    );
  });

  it("does not touch tags that only start with style", () => {
    expect(withStyleNonce("<styles>a</styles>", "abc")).toBe("<styles>a</styles>");
  });

  it("returns the html unchanged without a nonce", () => {
    expect(withStyleNonce("<style>a{}</style>", "")).toBe("<style>a{}</style>");
  });
});
