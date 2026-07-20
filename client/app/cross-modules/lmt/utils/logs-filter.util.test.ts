import { describe, expect, it } from "vitest";
import { filterLogServices, LOG_SEARCH_MIN_LENGTH } from "./logs-filter.util";
import type { LogServiceRow } from "@blocks-lmt/models/log-entry.model";

const rows: LogServiceRow[] = [
  { name: "blocks-idp-api", description: "Identity provider service" } as LogServiceRow,
  { name: "blocks-storage-api", description: "File storage service" } as LogServiceRow,
  { name: "blocks-lmt-api", description: "Logging metrics tracing" } as LogServiceRow,
];

const ascSort = { property: "Name", isDescending: false };

describe("filterLogServices", () => {
  it("returns rows sorted ascending by name when search is empty", () => {
    const result = filterLogServices({ rows, search: "", sort: ascSort });
    expect(result.map((r) => r.name)).toEqual([
      "blocks-idp-api",
      "blocks-lmt-api",
      "blocks-storage-api",
    ]);
  });

  it("sorts descending when isDescending is true", () => {
    const result = filterLogServices({
      rows,
      search: "",
      sort: { property: "Name", isDescending: true },
    });
    expect(result[0].name).toBe("blocks-storage-api");
  });

  it("sorts by description when requested", () => {
    const result = filterLogServices({
      rows,
      search: "",
      sort: { property: "Description", isDescending: false },
    });
    expect(result[0].description).toBe("File storage service");
  });

  it("returns rows unchanged for an unknown sort property", () => {
    const result = filterLogServices({
      rows,
      search: "",
      sort: { property: "Unknown", isDescending: false },
    });
    expect(result).toEqual(rows);
  });

  it("does not fuzzy-filter for searches shorter than the minimum length", () => {
    const result = filterLogServices({ rows, search: "id", sort: ascSort });
    expect(result).toHaveLength(rows.length);
  });

  it("fuzzy-filters when the search meets the minimum length", () => {
    const result = filterLogServices({ rows, search: "storage", sort: ascSort });
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((r) => r.name.includes("storage"))).toBe(true);
  });

  it("exposes the minimum search length constant", () => {
    expect(LOG_SEARCH_MIN_LENGTH).toBe(3);
  });
});
