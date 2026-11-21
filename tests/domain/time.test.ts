import { describe, expect, it } from "vitest";
import { formatThb, isWholeBaht, lineCostThb } from "@/lib/domain/money";
import {
  bangkokTimestamp,
  ceilToHalfHour,
  compareTimestamps,
  formatBangkokTime,
  isBangkokTimestamp,
  toEpochMs,
} from "@/lib/domain/time";

describe("Bangkok timestamps", () => {
  it("builds a +07:00 instant and formats the Bangkok clock", () => {
    const start = bangkokTimestamp("2026-11-21", "09:10");
    expect(start).toBe("2026-11-21T09:10:00+07:00");
    expect(toEpochMs(start)).toBe(Date.UTC(2026, 10, 21, 2, 10));
    expect(formatBangkokTime(start)).toBe("09:10");
    expect(formatBangkokTime("2028-02-29T00:00:00+07:00")).toBe("00:00");
  });

  it.each([
    ["2026-02-29", "12:30"],
    ["2026-04-31", "12:30"],
    ["2026-11-21", "9:10"],
    ["2026-11-21", "09"],
    ["2026-11-21", "24:00"],
    ["2026-11-21", "09:60"],
  ])("rejects invalid date or clock input %s %s", (date, time) => {
    expect(() => bangkokTimestamp(date, time)).toThrow(RangeError);
  });

  it.each([
    "2026-11-21T12:30:00",
    "2026-11-21T12:30:00Z",
    "2026-11-21T12:30:00+08:00",
    "2026-11-21T12:30:60+07:00",
    "2026-11-31T12:30:00+07:00",
  ])("rejects an invalid domain timestamp %s", (value) => {
    expect(isBangkokTimestamp(value)).toBe(false);
    expect(() => toEpochMs(value)).toThrow(RangeError);
  });

  it("compares epoch milliseconds across midnight and equivalent precisions", () => {
    const midnight = "2026-11-22T00:00:00+07:00";
    const before = "2026-11-21T23:59:59.999+07:00";
    expect(compareTimestamps(before, midnight)).toBe(-1);
    expect(compareTimestamps(midnight, before)).toBe(1);
    expect(compareTimestamps("2026-11-22T00:00+07:00", midnight)).toBe(0);
  });

  it.each([
    ["2026-11-21T13:00:00+07:00", "2026-11-21T13:00:00+07:00"],
    ["2026-11-21T13:30:00+07:00", "2026-11-21T13:30:00+07:00"],
    ["2026-11-21T13:01:01+07:00", "2026-11-21T13:30:00+07:00"],
    ["2026-11-21T13:30:00.000001+07:00", "2026-11-21T14:00:00+07:00"],
    ["2026-12-31T23:59:59.999+07:00", "2027-01-01T00:00:00+07:00"],
  ])("rounds %s up to %s", (input, expected) => {
    expect(ceilToHalfHour(input)).toBe(expected);
  });
});

it("displays whole baht and rejects amounts that cannot be represented exactly", () => {
  expect(formatThb(88)).toBe("฿88");
  expect(formatThb(0)).toBe("฿0");
  expect(isWholeBaht(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  expect(() => formatThb(88.5)).toThrow(RangeError);
});

it("multiplies a whole-baht unit cost by a positive quantity", () => {
  expect(lineCostThb(4, 8)).toBe(32);
  expect(lineCostThb(0, 8)).toBe(0);
  expect(lineCostThb(Number.MAX_SAFE_INTEGER, 1)).toBe(Number.MAX_SAFE_INTEGER);
});

it.each([
  [-1, 8],
  [4.5, 8],
  [4, 0],
  [4, 1.5],
  [0, Number.MAX_SAFE_INTEGER + 1],
  [Number.MAX_SAFE_INTEGER, 2],
])("rejects invalid or overflowing line cost %s times %s", (unitCost, quantity) => {
  expect(() => lineCostThb(unitCost, quantity)).toThrow(RangeError);
});
