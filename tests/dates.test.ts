import { describe, expect, it } from "vitest";
import { isoDateInTimeZone } from "../src/lib/dates";

describe("isoDateInTimeZone", () => {
  it("uses the requested user timezone around UTC midnight", () => {
    const instant = new Date("2026-08-30T00:30:00.000Z");
    expect(isoDateInTimeZone(instant, "UTC")).toBe("2026-08-30");
    expect(isoDateInTimeZone(instant, "America/Los_Angeles")).toBe("2026-08-29");
    expect(isoDateInTimeZone(instant, "Asia/Tokyo")).toBe("2026-08-30");
  });

  it("handles calendar changes across year boundaries", () => {
    const instant = new Date("2026-12-31T23:30:00.000Z");
    expect(isoDateInTimeZone(instant, "Pacific/Auckland")).toBe("2027-01-01");
  });
});
