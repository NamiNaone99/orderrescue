import { z } from "zod";

const isoDate = z.iso.date();
const bangkokClock = /^T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?\+07:00$/;
const halfHourMs = 30 * 60 * 1000;
const bangkokOffsetMs = 7 * 60 * 60 * 1000;
const bangkokTimeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
});

export function isBangkokTimestamp(value: string): boolean {
  return bangkokClock.test(value.slice(10)) && isoDate.safeParse(value.slice(0, 10)).success;
}

export function bangkokTimestamp(date: string, time: string): string {
  const value = `${date}T${time}:00+07:00`;
  if (time.length !== 5 || !isBangkokTimestamp(value)) {
    throw new RangeError("Expected a calendar date (YYYY-MM-DD) and time (HH:MM)");
  }
  return value;
}

export function toEpochMs(value: string): number {
  if (!isBangkokTimestamp(value)) {
    throw new RangeError("Expected an ISO timestamp with offset +07:00");
  }
  return Date.parse(value);
}

export function compareTimestamps(left: string, right: string): number {
  return Math.sign(toEpochMs(left) - toEpochMs(right));
}

export function formatBangkokTime(value: string): string {
  return bangkokTimeFormat.format(toEpochMs(value));
}

export function ceilToHalfHour(value: string): string {
  const epoch = toEpochMs(value);
  // Date.parse truncates fractions below a millisecond. Preserve upward rounding at a boundary.
  const hasSubMillisecond = /\.\d{3}\d*[1-9]/.test(value);
  const rounded = Math.ceil((epoch + Number(hasSubMillisecond)) / halfHourMs) * halfHourMs;
  const wallClock = new Date(rounded + bangkokOffsetMs).toISOString();
  return bangkokTimestamp(wallClock.slice(0, 10), wallClock.slice(11, 16));
}
