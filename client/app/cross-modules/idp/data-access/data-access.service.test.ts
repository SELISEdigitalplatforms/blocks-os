import { describe, expect, it } from "vitest";
import { PLATFORM_SERVICES } from "./data-access.service";

describe("PLATFORM_SERVICES", () => {
  it("lists every service whose system schemas the Data Access page shows, in filter order", () => {
    // The server's PlatformDataAccessController.Owners labels each schema with one of these.
    expect(PLATFORM_SERVICES).toEqual(["IAM", "OS", "Logic", "Release", "Monitor"]);
  });
});
