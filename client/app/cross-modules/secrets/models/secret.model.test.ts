import { describe, expect, it } from "vitest";
import {
  SECRET_STATUS,
  SECRET_STATUS_LABEL,
  SECRET_TYPE,
  SECRET_TYPE_LABEL,
  SECRET_TYPE_DESCRIPTION,
  SECRET_VALUE_MAX_BYTES,
  isApiSecret,
  isDeleted,
  looksLikeSecretId,
  secretValueByteLength,
  supportsValueReveal,
} from "./secret.model";

describe("secret model", () => {
  describe("wire values", () => {
    // Backend comparison is ordinal, so a capitalised value returns 400 INVALID_TYPE. These
    // assertions exist to fail loudly if someone "tidies" the constants into Pascal case.
    it("keeps type values lowercase", () => {
      expect(SECRET_TYPE.Api).toBe("api");
      expect(SECRET_TYPE.Service).toBe("service");
    });

    it("keeps status values lowercase", () => {
      expect(SECRET_STATUS.Active).toBe("active");
      expect(SECRET_STATUS.Locked).toBe("locked");
      expect(SECRET_STATUS.Deleted).toBe("deleted");
    });

    it("never shows the raw wire words to a person", () => {
      // "API" and "Service" say nothing about which one you want, so the labels describe the
      // thing instead. The values above stay lowercase regardless.
      expect(SECRET_TYPE_LABEL.api).toBe("Application");
      expect(SECRET_TYPE_LABEL.service).toBe("Platform service");
      expect(SECRET_TYPE_DESCRIPTION.api).toMatch(/who can read it/i);
      expect(SECRET_TYPE_DESCRIPTION.service).toMatch(/backend services/i);
    });

    it("capitalises statuses for display", () => {
      expect(SECRET_STATUS_LABEL.active).toBe("Active");
      expect(SECRET_STATUS_LABEL.locked).toBe("Locked");
      expect(SECRET_STATUS_LABEL.deleted).toBe("Deleted");
    });
  });

  describe("secretValueByteLength", () => {
    it("counts ASCII as one byte per character", () => {
      expect(secretValueByteLength("abcd")).toBe(4);
    });

    it("counts multi-byte characters by their UTF-8 length", () => {
      // A character count would pass a value that the vault then rejects.
      expect(secretValueByteLength("é")).toBe(2);
      expect(secretValueByteLength("😀")).toBe(4);
      expect("😀".length).toBe(2);
    });

    it("agrees with the 25 KB limit", () => {
      expect(SECRET_VALUE_MAX_BYTES).toBe(25 * 1024);
      expect(secretValueByteLength("a".repeat(SECRET_VALUE_MAX_BYTES))).toBe(
        SECRET_VALUE_MAX_BYTES,
      );
    });
  });

  describe("looksLikeSecretId", () => {
    it("matches a 32-character hex id", () => {
      expect(looksLikeSecretId("0123456789abcdef0123456789abcdef")).toBe(true);
    });

    it("ignores surrounding whitespace", () => {
      expect(looksLikeSecretId("  0123456789abcdef0123456789abcdef  ")).toBe(true);
    });

    it("accepts upper case hex", () => {
      expect(looksLikeSecretId("0123456789ABCDEF0123456789ABCDEF")).toBe(true);
    });

    it("rejects names, partial ids and dashed guids", () => {
      expect(looksLikeSecretId("payment-gateway-key")).toBe(false);
      expect(looksLikeSecretId("0123456789abcdef")).toBe(false);
      expect(looksLikeSecretId("01234567-89ab-cdef-0123-456789abcdef")).toBe(false);
      expect(looksLikeSecretId("")).toBe(false);
    });
  });

  describe("type predicates", () => {
    it("identifies api secrets", () => {
      expect(isApiSecret({ type: SECRET_TYPE.Api })).toBe(true);
      expect(isApiSecret({ type: SECRET_TYPE.Service })).toBe(false);
    });

    it("identifies deleted secrets", () => {
      expect(isDeleted({ status: SECRET_STATUS.Deleted })).toBe(true);
      expect(isDeleted({ status: SECRET_STATUS.Active })).toBe(false);
    });

    it("offers value reveal for api secrets only", () => {
      expect(supportsValueReveal({ type: SECRET_TYPE.Api })).toBe(true);
      expect(supportsValueReveal({ type: SECRET_TYPE.Service })).toBe(false);
    });
  });
});
