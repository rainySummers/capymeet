import { describe, expect, it } from "vitest";
import {
  BUSINESS_TIME_ZONE,
  BUSINESS_TIME_ZONE_LABEL,
  formatBusinessDate,
  formatBusinessDateTime,
  formatBusinessTimeRange,
  getUtcRangeForZonedDate,
  getZonedDateString,
  getZonedDay,
  getZonedMinutesSinceMidnight,
  overlaps,
  toIsoMinute,
  zonedDateTimeInputToUtcIso,
} from "./time";

describe("overlaps", () => {
  it("detects overlapping ranges", () => {
    expect(
      overlaps(
        "2026-04-28T10:00:00.000Z",
        "2026-04-28T11:00:00.000Z",
        "2026-04-28T10:30:00.000Z",
        "2026-04-28T11:30:00.000Z",
      ),
    ).toBe(true);
  });

  it("allows adjacent ranges", () => {
    expect(
      overlaps(
        "2026-04-28T10:00:00.000Z",
        "2026-04-28T11:00:00.000Z",
        "2026-04-28T11:00:00.000Z",
        "2026-04-28T12:00:00.000Z",
      ),
    ).toBe(false);
  });

  it("allows requested ranges ending when an existing range starts", () => {
    expect(
      overlaps(
        "2026-04-28T11:00:00.000Z",
        "2026-04-28T12:00:00.000Z",
        "2026-04-28T10:00:00.000Z",
        "2026-04-28T11:00:00.000Z",
      ),
    ).toBe(false);
  });
});

describe("toIsoMinute", () => {
  it("normalizes an ISO timestamp to minute precision", () => {
    expect(toIsoMinute("2026-04-28T10:15:37.123Z")).toBe("2026-04-28T10:15:00.000Z");
  });
});

describe("timezone helpers", () => {
  it("uses Europe/Berlin as the business timezone", () => {
    expect(BUSINESS_TIME_ZONE).toBe("Europe/Berlin");
    expect(BUSINESS_TIME_ZONE_LABEL).toBe("Germany time (Europe/Berlin)");
  });

  it("builds a UTC range for a Berlin winter date", () => {
    expect(getUtcRangeForZonedDate("2026-01-15", BUSINESS_TIME_ZONE)).toEqual({
      startTime: "2026-01-14T23:00:00.000Z",
      endTime: "2026-01-15T23:00:00.000Z",
    });
  });

  it("builds a UTC range for a Berlin summer date", () => {
    expect(getUtcRangeForZonedDate("2026-07-15", BUSINESS_TIME_ZONE)).toEqual({
      startTime: "2026-07-14T22:00:00.000Z",
      endTime: "2026-07-15T22:00:00.000Z",
    });
  });

  it("uses the shorter UTC range on Berlin spring DST transition day", () => {
    expect(getUtcRangeForZonedDate("2026-03-29", BUSINESS_TIME_ZONE)).toEqual({
      startTime: "2026-03-28T23:00:00.000Z",
      endTime: "2026-03-29T22:00:00.000Z",
    });
  });

  it("reads Berlin date, weekday, and minutes from UTC instants", () => {
    const instant = "2026-04-29T08:30:00.000Z";

    expect(getZonedDateString(instant, BUSINESS_TIME_ZONE)).toBe("2026-04-29");
    expect(getZonedDay(instant, BUSINESS_TIME_ZONE)).toBe(3);
    expect(getZonedMinutesSinceMidnight(instant, BUSINESS_TIME_ZONE)).toBe(10 * 60 + 30);
  });

  it("formats booking times in Germany time instead of the runtime local timezone", () => {
    expect(formatBusinessTimeRange("2026-04-29T08:00:00.000Z", "2026-04-29T09:00:00.000Z")).toBe(
      "10:00 - 11:00",
    );
    expect(formatBusinessDate("2026-04-29T08:00:00.000Z", "en-US")).toBe("Apr 29, 2026");
    expect(formatBusinessDateTime("2026-04-29T08:00:00.000Z", "en-US")).toBe(
      "Apr 29, 2026, 10:00",
    );
  });

  it("serializes date-time inputs as Germany time", () => {
    expect(zonedDateTimeInputToUtcIso("2026-04-29T10:00")).toBe("2026-04-29T08:00:00.000Z");
    expect(zonedDateTimeInputToUtcIso("2026-01-15T10:00")).toBe("2026-01-15T09:00:00.000Z");
  });
});
