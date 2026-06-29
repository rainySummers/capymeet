export const BUSINESS_TIME_ZONE = "Europe/Berlin";
export const BUSINESS_TIME_ZONE_LABEL = "Germany time (Europe/Berlin)";

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

const weekdayByName: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function parseDateOnly(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error("Invalid date");
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parseTimeOnly(value: string): { hour: number; minute: number; second: number } {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) {
    throw new Error("Invalid time");
  }
  return {
    hour: Number(match[1]),
    minute: Number(match[2]),
    second: match[3] ? Number(match[3]) : 0,
  };
}

function addDaysToDateString(value: string, days: number): string {
  const { year, month, day } = parseDateOnly(value);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function parseDateTimeLocal(value: string): { date: string; time: string } {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)$/.exec(value);
  if (!match) {
    throw new Error("Invalid date-time");
  }
  return { date: match[1], time: match[2] };
}

export function formatBusinessTime(value: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value instanceof Date ? value : new Date(value));
}

export function formatBusinessTimeRange(startTime: string | Date, endTime: string | Date): string {
  return `${formatBusinessTime(startTime)} - ${formatBusinessTime(endTime)}`;
}

export function formatBusinessDate(
  value: string | Date,
  locale = "en-US",
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: BUSINESS_TIME_ZONE,
    ...options,
  }).format(value instanceof Date ? value : new Date(value));
}

export function formatBusinessDateTime(value: string | Date, locale = "en-US"): string {
  return `${formatBusinessDate(value, locale)}, ${formatBusinessTime(value)}`;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function getZonedParts(value: string | Date, timeZone = BUSINESS_TIME_ZONE): ZonedParts {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    calendar: "gregory",
    numberingSystem: "latn",
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const entries = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekday = weekdayByName[entries.weekday];
  if (weekday === undefined) {
    throw new Error("Invalid weekday");
  }
  return {
    year: Number(entries.year),
    month: Number(entries.month),
    day: Number(entries.day),
    hour: Number(entries.hour),
    minute: Number(entries.minute),
    second: Number(entries.second),
    weekday,
  };
}

export function getZonedDateString(value: string | Date, timeZone = BUSINESS_TIME_ZONE): string {
  const parts = getZonedParts(value, timeZone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function getZonedDay(value: string | Date, timeZone = BUSINESS_TIME_ZONE): number {
  return getZonedParts(value, timeZone).weekday;
}

export function getZonedMinutesSinceMidnight(value: string | Date, timeZone = BUSINESS_TIME_ZONE): number {
  const parts = getZonedParts(value, timeZone);
  return parts.hour * 60 + parts.minute;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return zonedAsUtc - date.getTime();
}

export function zonedDateTimeToUtc(date: string, time: string, timeZone = BUSINESS_TIME_ZONE): Date {
  const dateParts = parseDateOnly(date);
  const timeParts = parseTimeOnly(time);
  const localAsUtc = Date.UTC(
    dateParts.year,
    dateParts.month - 1,
    dateParts.day,
    timeParts.hour,
    timeParts.minute,
    timeParts.second,
  );
  let utc = localAsUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const offset = getTimeZoneOffsetMs(new Date(utc), timeZone);
    const nextUtc = localAsUtc - offset;
    if (nextUtc === utc) {
      break;
    }
    utc = nextUtc;
  }

  return new Date(utc);
}

export function zonedDateTimeInputToUtcIso(value: string, timeZone = BUSINESS_TIME_ZONE): string {
  const { date, time } = parseDateTimeLocal(value);
  return zonedDateTimeToUtc(date, time, timeZone).toISOString();
}

export function getUtcRangeForZonedDate(date: string, timeZone = BUSINESS_TIME_ZONE): { startTime: string; endTime: string } {
  const start = zonedDateTimeToUtc(date, "00:00", timeZone);
  const end = zonedDateTimeToUtc(addDaysToDateString(date, 1), "00:00", timeZone);
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

export function toIsoMinute(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }
  date.setUTCSeconds(0, 0);
  return date.toISOString();
}

export function overlaps(
  existingStart: string,
  existingEnd: string,
  requestedStart: string,
  requestedEnd: string,
): boolean {
  return new Date(existingStart).getTime() < new Date(requestedEnd).getTime()
    && new Date(existingEnd).getTime() > new Date(requestedStart).getTime();
}

export function minutesBetween(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 60000;
}
