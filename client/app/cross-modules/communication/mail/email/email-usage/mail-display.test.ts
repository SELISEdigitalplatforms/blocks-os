import { describe, expect, it } from "vitest";
import {
  buildMailFrameDocument,
  formatMailDate,
  getInitials,
  looksLikeHtml,
  parseAddress,
  parseAddressList,
  toPreview,
} from "./mail-display";

describe("parseAddress", () => {
  it("splits a quoted display name from the address", () => {
    expect(parseAddress('"Abdullah Al Momen" <momen@gmail.com>')).toEqual({
      name: "Abdullah Al Momen",
      email: "momen@gmail.com",
    });
  });

  it("uses the address as the name when there is none", () => {
    expect(parseAddress("support@amlora.ch")).toEqual({
      name: "support@amlora.ch",
      email: "support@amlora.ch",
    });
    expect(parseAddress("<a@x.com>")).toEqual({ name: "a@x.com", email: "a@x.com" });
  });
});

describe("parseAddressList", () => {
  it("does not split on a comma inside a quoted name", () => {
    expect(parseAddressList('"Doe, Jane" <jane@x.com>, bob@y.com')).toEqual([
      { name: "Doe, Jane", email: "jane@x.com" },
      { name: "bob@y.com", email: "bob@y.com" },
    ]);
  });

  it("returns nothing for an empty header", () => {
    expect(parseAddressList(undefined)).toEqual([]);
  });
});

describe("getInitials", () => {
  it("takes the first and last word of the name", () => {
    expect(getInitials({ name: "Abdullah Al Momen", email: "" })).toBe("AM");
  });

  it("falls back to the local part of the address", () => {
    expect(getInitials({ name: "noreply@github.com", email: "noreply@github.com" })).toBe("NO");
  });
});

describe("formatMailDate", () => {
  const now = new Date(2026, 8, 23, 20, 0);

  it("shows the time for today", () => {
    expect(formatMailDate(new Date(2026, 8, 23, 9, 5), now)).toBe("09:05");
  });

  it("shows day and month for this year", () => {
    expect(formatMailDate(new Date(2026, 8, 22, 11, 22), now)).toBe("22 Sep");
  });

  it("shows the full date for an earlier year", () => {
    expect(formatMailDate(new Date(2025, 0, 3), now)).toBe("03/01/2025");
  });

  it("handles an invalid value", () => {
    expect(formatMailDate("not a date", now)).toBe("-");
  });
});

describe("toPreview", () => {
  it("strips link targets, markdown decoration and extra whitespace", () => {
    const body = "Ready to **send**?\r\n\r\n[ Start an email](https://app.brevo.com/x)\r\n------";
    expect(toPreview(body)).toBe("Ready to send ? Start an email");
  });

  it("strips markup from an HTML body", () => {
    expect(toPreview("<style>p{}</style><p>Hello&nbsp;<b>there</b></p>")).toBe("Hello there");
  });

  it("truncates with an ellipsis", () => {
    expect(toPreview("a".repeat(200), 10)).toBe(`${"a".repeat(10)}…`);
  });
});

describe("mail frame", () => {
  it("detects HTML bodies", () => {
    expect(looksLikeHtml("<div>hi</div>")).toBe(true);
    expect(looksLikeHtml("plain text")).toBe(false);
  });

  it("opens links in a new tab and forbids scripts via CSP", () => {
    const doc = buildMailFrameDocument("<p>hi</p>");
    expect(doc).toContain('<base target="_blank">');
    expect(doc).toContain("default-src 'none'");
    expect(doc).toContain("<p>hi</p>");
  });
});
