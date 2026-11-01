import { describe, expect, it } from "vitest";
import {
  REGISTER_SERVICE_TYPE,
  getRegisterServiceTypes,
  getRegisterServiceEnvironments,
  getLogLevels,
  getServiceStatus,
  getTraceStatus,
} from "./index";

describe("identifier constants", () => {
  it("maps the service type enum to labelled options", () => {
    expect(REGISTER_SERVICE_TYPE.Api).toBe(1);
    expect(getRegisterServiceTypes().find((t) => t.value === REGISTER_SERVICE_TYPE.Worker)?.label).toBe(
      "Worker",
    );
    expect(getRegisterServiceTypes()).toHaveLength(3);
  });

  it("exposes environment, log level, service and trace status options", () => {
    expect(getRegisterServiceEnvironments().map((e) => e.value)).toEqual(["prod", "stg", "dev"]);
    expect(getLogLevels().map((l) => l.value)).toContain("fatal");
    expect(getServiceStatus().map((s) => s.value)).toContain("active");
    expect(getTraceStatus().find((t) => t.value === "ok")?.label).toBe("Success");
  });
});
