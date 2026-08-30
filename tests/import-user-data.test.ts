import { describe, expect, it } from "vitest";
import { parseFlowDayImport } from "../src/lib/import-user-data";

describe("Flow Day data import validation", () => {
  it("accepts supported Flow Day exports", () => {
    const payload = parseFlowDayImport(
      JSON.stringify({
        application: "Flow Day Planner",
        schema_version: 2,
        categories: [{ id: "category-1", name: "Travail" }],
        tasks: [],
      }),
    );

    expect(payload.schema_version).toBe(2);
    expect(payload.categories).toHaveLength(1);
  });

  it("rejects malformed, foreign and future exports", () => {
    expect(() => parseFlowDayImport("not-json")).toThrow(/JSON valide/);
    expect(() =>
      parseFlowDayImport(JSON.stringify({ application: "Other", schema_version: 2 })),
    ).toThrow(/export Flow Day Planner/);
    expect(() =>
      parseFlowDayImport(JSON.stringify({ application: "Flow Day Planner", schema_version: 99 })),
    ).toThrow(/Version/);
    expect(() =>
      parseFlowDayImport(
        JSON.stringify({ application: "Flow Day Planner", schema_version: 2, tasks: {} }),
      ),
    ).toThrow(/tasks/);
  });
});
