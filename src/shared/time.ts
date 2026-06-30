export const BUSINESS_TIME_ZONE = "Europe/Berlin";
export const BUSINESS_TIME_ZONE_LABEL = "Germany time (Europe/Berlin)";

export type TimeZoneLabelLanguage = "en" | "zh";

export interface BusinessTimeZoneOption {
  value: string;
  labelEn: string;
  labelZh: string;
  emailLabel: string;
}

export const BUSINESS_TIME_ZONE_OPTIONS: BusinessTimeZoneOption[] = [
  {
    value: "Europe/Berlin",
    labelEn: "Germany time (Europe/Berlin)",
    labelZh: "德国时间（Europe/Berlin）",
    emailLabel: "Europe/Berlin (Berlin time)",
  },
  {
    value: "Asia/Shanghai",
    labelEn: "China time (Asia/Shanghai)",
    labelZh: "中国时间（Asia/Shanghai）",
    emailLabel: "Asia/Shanghai (China time)",
  },
  {
    value: "Asia/Hong_Kong",
    labelEn: "Hong Kong time (Asia/Hong_Kong)",
    labelZh: "香港时间（Asia/Hong_Kong）",
    emailLabel: "Asia/Hong_Kong (Hong Kong time)",
  },
  {
    value: "Asia/Singapore",
    labelEn: "Singapore time (Asia/Singapore)",
    labelZh: "新加坡时间（Asia/Singapore）",
    emailLabel: "Asia/Singapore (Singapore time)",
  },
  {
    value: "Asia/Tokyo",
    labelEn: "Tokyo time (Asia/Tokyo)",
    labelZh: "东京时间（Asia/Tokyo）",
    emailLabel: "Asia/Tokyo (Tokyo time)",
  },
  {
    value: "Asia/Dubai",
    labelEn: "Dubai time (Asia/Dubai)",
    labelZh: "迪拜时间（Asia/Dubai）",
    emailLabel: "Asia/Dubai (Dubai time)",
  },
  {
    value: "Asia/Kolkata",
    labelEn: "India time (Asia/Kolkata)",
    labelZh: "印度时间（Asia/Kolkata）",
    emailLabel: "Asia/Kolkata (India time)",
  },
  {
    value: "Europe/London",
    labelEn: "London time (Europe/London)",
    labelZh: "伦敦时间（Europe/London）",
    emailLabel: "Europe/London (London time)",
  },
  {
    value: "Europe/Paris",
    labelEn: "Paris time (Europe/Paris)",
    labelZh: "巴黎时间（Europe/Paris）",
    emailLabel: "Europe/Paris (Paris time)",
  },
  {
    value: "America/New_York",
    labelEn: "New York time (America/New_York)",
    labelZh: "纽约时间（America/New_York）",
    emailLabel: "America/New_York (New York time)",
  },
  {
    value: "America/Chicago",
    labelEn: "Chicago time (America/Chicago)",
    labelZh: "芝加哥时间（America/Chicago）",
    emailLabel: "America/Chicago (Chicago time)",
  },
  {
    value: "America/Denver",
    labelEn: "Denver time (America/Denver)",
    labelZh: "丹佛时间（America/Denver）",
    emailLabel: "America/Denver (Denver time)",
  },
  {
    value: "America/Los_Angeles",
    labelEn: "Los Angeles time (America/Los_Angeles)",
    labelZh: "洛杉矶时间（America/Los_Angeles）",
    emailLabel: "America/Los_Angeles (Los Angeles time)",
  },
  {
    value: "America/Toronto",
    labelEn: "Toronto time (America/Toronto)",
    labelZh: "多伦多时间（America/Toronto）",
    emailLabel: "America/Toronto (Toronto time)",
  },
  {
    value: "America/Sao_Paulo",
    labelEn: "Sao Paulo time (America/Sao_Paulo)",
    labelZh: "圣保罗时间（America/Sao_Paulo）",
    emailLabel: "America/Sao_Paulo (Sao Paulo time)",
  },
  {
    value: "Australia/Sydney",
    labelEn: "Sydney time (Australia/Sydney)",
    labelZh: "悉尼时间（Australia/Sydney）",
    emailLabel: "Australia/Sydney (Sydney time)",
  },
  {
    value: "Pacific/Auckland",
    labelEn: "Auckland time (Pacific/Auckland)",
    labelZh: "奥克兰时间（Pacific/Auckland）",
    emailLabel: "Pacific/Auckland (Auckland time)",
  },
  {
    value: "UTC",
    labelEn: "UTC (UTC)",
    labelZh: "协调世界时（UTC）",
    emailLabel: "UTC",
  },
];

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

export function formatBusinessTime(value: string | Date, timeZone = BUSINESS_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value instanceof Date ? value : new Date(value));
}

export function formatBusinessTimeRange(
  startTime: string | Date,
  endTime: string | Date,
  timeZone = BUSINESS_TIME_ZONE,
): string {
  return `${formatBusinessTime(startTime, timeZone)} - ${formatBusinessTime(endTime, timeZone)}`;
}

export function formatBusinessDate(
  value: string | Date,
  locale = "en-US",
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
  timeZone = BUSINESS_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    ...options,
  }).format(value instanceof Date ? value : new Date(value));
}

export function formatBusinessDateTime(value: string | Date, locale = "en-US", timeZone = BUSINESS_TIME_ZONE): string {
  return `${formatBusinessDate(value, locale, { year: "numeric", month: "short", day: "numeric" }, timeZone)}, ${formatBusinessTime(value, timeZone)}`;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function formatBusinessTimeZoneLabel(
  timeZone = BUSINESS_TIME_ZONE,
  language: TimeZoneLabelLanguage = "en",
): string {
  const option = BUSINESS_TIME_ZONE_OPTIONS.find((candidate) => candidate.value === timeZone);
  if (option) {
    return language === "zh" ? option.labelZh : option.labelEn;
  }
  return timeZone;
}

export function formatEmailTimeZoneLabel(timeZone = BUSINESS_TIME_ZONE): string {
  const option = BUSINESS_TIME_ZONE_OPTIONS.find((candidate) => candidate.value === timeZone);
  return option?.emailLabel ?? timeZone;
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
