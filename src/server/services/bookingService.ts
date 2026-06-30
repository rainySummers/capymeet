import type { Booking, BookingSource, BookingStatus, Room } from "../../shared/types";
import {
  BUSINESS_TIME_ZONE,
  getZonedDateString,
  getZonedDay,
  getZonedMinutesSinceMidnight,
  minutesBetween,
  overlaps,
} from "../../shared/time";
import { nowIso } from "../db";
import { insertBookingIfNoConflict, listBlockingBookings } from "../repositories/bookingsRepository";
import { getRoomById } from "../repositories/roomsRepository";

export interface CreateBookingRequest {
  title: string;
  contactName: string;
  email: string | null;
  startTime: string;
  endTime: string;
  source: BookingSource;
  forceConfirmed?: boolean;
  businessTimeZone?: string;
}

export type BookingDecision =
  | { ok: true; status: Extract<BookingStatus, "confirmed" | "pending_approval"> }
  | {
      ok: false;
      error:
        | "room_disabled"
        | "invalid_time_range"
        | "outside_opening_hours"
        | "booking_too_far_in_advance"
        | "duration_too_short"
        | "duration_too_long"
        | "slot_interval_invalid"
        | "booking_conflict";
    };

function isDateOnly(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseHour(value: string): number | null {
  const [hour, minute] = value.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

type RoomScheduleDecision = "ok" | "invalid_time_range" | "outside_opening_hours" | "booking_too_far_in_advance";

function fitsRoomSchedule(
  room: Room,
  startTime: string,
  endTime: string,
  now: string,
  businessTimeZone: string,
): RoomScheduleDecision {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const current = new Date(now);
  if ([start, end, current].some((date) => Number.isNaN(date.getTime()))) {
    return "invalid_time_range";
  }

  if (start.getTime() - current.getTime() > room.maxAdvanceDays * 24 * 60 * 60 * 1000) {
    return "booking_too_far_in_advance";
  }

  try {
    const openingHours = JSON.parse(room.openingHours) as {
      startDate?: unknown;
      endDate?: unknown;
      days?: number[];
      start?: string;
      end?: string;
    };
    if (isDateOnly(openingHours.startDate) || isDateOnly(openingHours.endDate)) {
      const open = typeof openingHours.start === "string" ? parseHour(openingHours.start) : parseHour("09:00");
      const close = typeof openingHours.end === "string" ? parseHour(openingHours.end) : parseHour("17:00");
      if (
        !isDateOnly(openingHours.startDate) ||
        !isDateOnly(openingHours.endDate) ||
        openingHours.startDate > openingHours.endDate ||
        open === null ||
        close === null ||
        open >= close
      ) {
        return "outside_opening_hours";
      }

      const startDate = getZonedDateString(start, businessTimeZone);
      const endDate = getZonedDateString(end, businessTimeZone);
      return (
        startDate === endDate &&
        startDate >= openingHours.startDate &&
        endDate <= openingHours.endDate &&
        getZonedMinutesSinceMidnight(start, businessTimeZone) >= open &&
        getZonedMinutesSinceMidnight(end, businessTimeZone) <= close
      ) ? "ok" : "outside_opening_hours";
    }

    const open = typeof openingHours.start === "string" ? parseHour(openingHours.start) : null;
    const close = typeof openingHours.end === "string" ? parseHour(openingHours.end) : null;
    const days = Array.isArray(openingHours.days) ? openingHours.days : [];
    if (open === null || close === null || days.length === 0) {
      return "outside_opening_hours";
    }

    const startDay = getZonedDay(start, businessTimeZone);
    const endDay = getZonedDay(end, businessTimeZone);
    return (
      startDay === endDay &&
      days.includes(startDay) &&
      getZonedMinutesSinceMidnight(start, businessTimeZone) >= open &&
      getZonedMinutesSinceMidnight(end, businessTimeZone) <= close
    ) ? "ok" : "outside_opening_hours";
  } catch {
    return "outside_opening_hours";
  }
}

function addMinutes(value: string, minutes: number): string {
  return new Date(new Date(value).getTime() + minutes * 60 * 1000).toISOString();
}

function overlapsWithRoomBuffer(
  room: Room,
  existingStart: string,
  existingEnd: string,
  requestedStart: string,
  requestedEnd: string,
): boolean {
  const bufferMinutes = Number.isInteger(room.bufferMinutes) && room.bufferMinutes > 0 ? room.bufferMinutes : 0;
  return overlaps(
    existingStart,
    existingEnd,
    addMinutes(requestedStart, -bufferMinutes),
    addMinutes(requestedEnd, bufferMinutes),
  );
}

export function createBookingDecision(input: {
  room: Room;
  existingBookings: Booking[];
  now: string;
  request: CreateBookingRequest;
}): BookingDecision {
  const { room, existingBookings, request } = input;
  const businessTimeZone = request.businessTimeZone ?? BUSINESS_TIME_ZONE;

  if (!room.isEnabled) {
    return { ok: false, error: "room_disabled" };
  }

  const duration = minutesBetween(request.startTime, request.endTime);
  if (!Number.isFinite(duration) || duration <= 0) {
    return { ok: false, error: "invalid_time_range" };
  }
  if (duration < room.minDurationMinutes) {
    return { ok: false, error: "duration_too_short" };
  }
  if (duration > room.maxDurationMinutes) {
    return { ok: false, error: "duration_too_long" };
  }
  const scheduleDecision = fitsRoomSchedule(room, request.startTime, request.endTime, input.now, businessTimeZone);
  if (scheduleDecision !== "ok") {
    return { ok: false, error: scheduleDecision };
  }
  const hasConflict = existingBookings
    .filter((booking) => booking.status === "confirmed" || booking.status === "pending_approval")
    .some((booking) => overlapsWithRoomBuffer(room, booking.startTime, booking.endTime, request.startTime, request.endTime));

  if (hasConflict) {
    return { ok: false, error: "booking_conflict" };
  }

  return { ok: true, status: room.requiresApproval ? "pending_approval" : "confirmed" };
}

export async function createBooking(
  db: D1Database,
  input: CreateBookingRequest & { roomId: string },
): Promise<BookingDecision & { bookingId?: string }> {
  const room = await getRoomById(db, input.roomId);
  if (!room) {
    return { ok: false, error: "room_disabled" };
  }

  const bufferMinutes = Number.isInteger(room.bufferMinutes) && room.bufferMinutes > 0 ? room.bufferMinutes : 0;
  const conflictStartTime = addMinutes(input.startTime, -bufferMinutes);
  const conflictEndTime = addMinutes(input.endTime, bufferMinutes);
  const existingBookings = await listBlockingBookings(db, input.roomId, conflictStartTime, conflictEndTime);
  const decision = createBookingDecision({
    room,
    existingBookings,
    now: nowIso(),
    request: input,
  });

  if (!decision.ok) {
    return decision;
  }

  const now = nowIso();
  const bookingId = crypto.randomUUID();
  const didInsert = await insertBookingIfNoConflict(
    db,
    {
      id: bookingId,
      roomId: input.roomId,
      title: input.title,
      contactName: input.contactName,
      email: input.email,
      startTime: input.startTime,
      endTime: input.endTime,
      status: input.forceConfirmed ? "confirmed" : decision.status,
      source: input.source,
      createdAt: now,
      updatedAt: now,
      cancelledAt: null,
      cancelledBy: null,
      reviewedByAdminId: null,
      reviewedAt: null,
    },
    conflictStartTime,
    conflictEndTime,
  );

  if (!didInsert) {
    return { ok: false, error: "booking_conflict" };
  }

  return { ...decision, status: input.forceConfirmed ? "confirmed" : decision.status, bookingId };
}
