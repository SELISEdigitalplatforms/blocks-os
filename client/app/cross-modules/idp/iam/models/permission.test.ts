import { describe, expect, it } from "vitest";
import {
  PermissionSeverityLevel,
  PERMISSION_SEVERITY_OPTIONS,
  normalizePermissionSeverity,
  getSeverityOptionsFromResponse,
} from "./permission";

describe("permission model", () => {
  describe("normalizePermissionSeverity", () => {
    it("returns undefined for nullish or empty values", () => {
      expect(normalizePermissionSeverity(null)).toBeUndefined();
      expect(normalizePermissionSeverity(undefined)).toBeUndefined();
      expect(normalizePermissionSeverity("")).toBeUndefined();
    });

    it("returns a valid numeric level unchanged", () => {
      expect(normalizePermissionSeverity(PermissionSeverityLevel.Critical)).toBe(
        PermissionSeverityLevel.Critical,
      );
    });

    it("parses a numeric string level", () => {
      expect(normalizePermissionSeverity("1")).toBe(PermissionSeverityLevel.Critical);
    });

    it("matches an option by id or label case-insensitively", () => {
      expect(normalizePermissionSeverity("critical")).toBe(PermissionSeverityLevel.Critical);
      expect(normalizePermissionSeverity("High")).toBe(PermissionSeverityLevel.High);
    });

    it("returns undefined for an unknown string", () => {
      expect(normalizePermissionSeverity("unknown")).toBeUndefined();
    });
  });

  describe("getSeverityOptionsFromResponse", () => {
    it("returns all options when the response is empty", () => {
      expect(getSeverityOptionsFromResponse(undefined)).toBe(PERMISSION_SEVERITY_OPTIONS);
      expect(getSeverityOptionsFromResponse([] as never)).toBe(PERMISSION_SEVERITY_OPTIONS);
    });

    it("maps response severity levels to their options", () => {
      const result = getSeverityOptionsFromResponse([
        { severityLevel: "Critical" },
        { severityLevel: "Low" },
      ] as never);
      expect(result.map((o) => o.id)).toEqual(["Critical", "Low"]);
    });

    it("drops severity levels that do not match any option", () => {
      const result = getSeverityOptionsFromResponse([
        { severityLevel: "Critical" },
        { severityLevel: "Bogus" },
      ] as never);
      expect(result.map((o) => o.id)).toEqual(["Critical"]);
    });
  });
});
