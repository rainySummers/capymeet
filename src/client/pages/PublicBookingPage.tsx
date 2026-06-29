import { useEffect, useMemo, useState } from "react";

import type { Room } from "../../shared/types";
import {
  BUSINESS_TIME_ZONE_LABEL,
  formatBusinessTimeRange,
  getZonedDateString,
  getZonedMinutesSinceMidnight,
  minutesBetween,
  zonedDateTimeToUtc,
} from "../../shared/time";
import { api, ApiError, type PublicRoomBooking } from "../api";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

const bookingErrorMessages: Record<string, string> = {
  booking_conflict: "This time is already occupied by an existing booking.",
  invalid_time_range: "End time must be after start time.",
  outside_opening_hours: "Booking date must be within this room's opening dates.",
  booking_too_far_in_advance: "Booking is too far in advance for this room.",
  duration_too_short: "Booking is shorter than the minimum duration.",
  duration_too_long: "Booking is longer than the maximum duration.",
  room_disabled: "This room is not available for booking.",
  slot_interval_invalid: "Start and end times must match this room's booking interval.",
};

const selectedConflictMessage = "Selected time is already occupied by an existing booking.";
const selectedBufferConflictMessage = "Selected time is too close to an existing booking buffer.";
const outOfOpeningDatesMessage = "Booking date must be within this room's opening dates.";
const outOfOpeningTimeMessage = "Booking time must be within this room's opening time range.";
const invalidEmailMessage = "Please enter a valid email address.";
const bookingAvailabilityStartTime = "09:00";
const bookingAvailabilityEndTime = "17:00";
const bookingTimeSlotMinutes = 30;

type OpeningSchedule = { startDate: string; endDate: string; start: string; end: string };
type SelectedTimeValidation = { message: string; conflictingBookingIds: Set<string> };

function parseTimeToMinutes(time: string): number | null {
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return hour * 60 + minute;
}

function localDateAndTimeToIso(date: string, time: string): string | null {
  try {
    return zonedDateTimeToUtc(date, time).toISOString();
  } catch {
    return null;
  }
}

function overlaps(startA: string, endA: string, startB: string, endB: string): boolean {
  return new Date(startA).getTime() < new Date(endB).getTime()
    && new Date(endA).getTime() > new Date(startB).getTime();
}

function addMinutes(value: string, minutes: number): string {
  return new Date(new Date(value).getTime() + minutes * 60 * 1000).toISOString();
}

function isTimeOnly(value: unknown): value is string {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

function isValidEmailFormat(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseOpeningSchedule(openingHours: string): OpeningSchedule | null {
  try {
    const parsed = JSON.parse(openingHours) as {
      startDate?: unknown;
      endDate?: unknown;
      start?: unknown;
      end?: unknown;
    };
    if (typeof parsed.startDate !== "string" || typeof parsed.endDate !== "string") {
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.endDate)) {
      return null;
    }
    return parsed.startDate <= parsed.endDate
      ? {
          startDate: parsed.startDate,
          endDate: parsed.endDate,
          start: isTimeOnly(parsed.start) ? parsed.start : bookingAvailabilityStartTime,
          end: isTimeOnly(parsed.end) ? parsed.end : bookingAvailabilityEndTime,
        }
      : null;
  } catch {
    return null;
  }
}

function isDateWithinOpeningRange(date: string, range: OpeningSchedule | null): boolean {
  return !range || (date >= range.startDate && date <= range.endDate);
}

function formatBookingTime(startTime: string, endTime: string): string {
  return formatBusinessTimeRange(startTime, endTime);
}

function formatOpeningDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(parsed);
}

function formatOpeningHours(openingHours: string): string | null {
  const range = parseOpeningSchedule(openingHours);
  if (!range) {
    return null;
  }
  return `Bookings are available from ${formatOpeningDate(range.startDate)} to ${formatOpeningDate(range.endDate)}, from ${range.start} to ${range.end} (${BUSINESS_TIME_ZONE_LABEL}).`;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatBookingGuidance(room: Room | null): string {
  const sentences = [`Times are shown and submitted as ${BUSINESS_TIME_ZONE_LABEL}.`];

  if (!room) {
    sentences.push("Select a room to view booking limits.");
    return sentences.join(" ");
  }

  if (isPositiveInteger(room.minDurationMinutes)) {
    sentences.push(`Minimum booking duration is ${formatCount(room.minDurationMinutes, "minute", "minutes")}.`);
  }
  if (isPositiveInteger(room.maxDurationMinutes)) {
    sentences.push(`Maximum meeting duration is ${formatCount(room.maxDurationMinutes, "minute", "minutes")}.`);
  }
  if (isPositiveInteger(room.maxAdvanceDays)) {
    sentences.push(`Bookings can be made up to ${formatCount(room.maxAdvanceDays, "day", "days")} in advance.`);
  }
  if (isPositiveInteger(room.bufferMinutes)) {
    sentences.push(`A ${room.bufferMinutes}-minute buffer between meetings is required.`);
  } else if (room.bufferMinutes === 0) {
    sentences.push("No buffer between meetings is required.");
  }
  sentences.push(
    room.requiresApproval ? "Bookings require administrator approval." : "Bookings are confirmed automatically.",
  );

  return sentences.join(" ");
}

type PublicBookingPageProps = {
  embedded?: boolean;
  initialRoomId?: string;
  linkToken?: string;
  onBack?: () => void;
};

export function PublicBookingPage({ embedded = false, linkToken, initialRoomId = "", onBack }: PublicBookingPageProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState(initialRoomId);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [bookings, setBookings] = useState<PublicRoomBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [emailHasFormatError, setEmailHasFormatError] = useState(false);
  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );
  const selectedRoomOpeningDateRange = useMemo(
    () => (selectedRoom ? parseOpeningSchedule(selectedRoom.openingHours) : null),
    [selectedRoom],
  );
  const selectedRoomOpeningStartTime = selectedRoomOpeningDateRange?.start ?? bookingAvailabilityStartTime;
  const selectedRoomOpeningEndTime = selectedRoomOpeningDateRange?.end ?? bookingAvailabilityEndTime;

  useEffect(() => {
    let cancelled = false;
    const loadRooms = linkToken ? api.getBookingLink(linkToken) : api.listRooms();
    loadRooms
      .then((result) => {
        if (!cancelled) {
          setRooms(result.rooms);
          setSelectedRoomId((current) =>
            current && result.rooms.some((room) => room.id === current) ? current : "",
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoomsError("Could not load rooms.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [linkToken]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedRoomId || !bookingDate || !isDateWithinOpeningRange(bookingDate, selectedRoomOpeningDateRange)) {
      setBookings([]);
      setBookingsError(null);
      setBookingsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setBookingsLoading(true);
    setBookingsError(null);
    setBookings([]);
    api
      .listPublicBookings(selectedRoomId, bookingDate)
      .then((result) => {
        if (!cancelled) {
          setBookings(result.bookings);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBookings([]);
          setBookingsError("Could not load bookings.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBookingsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedRoomId, bookingDate, selectedRoomOpeningDateRange]);

  useEffect(() => {
    if (bookingDate && !isDateWithinOpeningRange(bookingDate, selectedRoomOpeningDateRange)) {
      setBookingDate("");
      setBookings([]);
      setSubmitState({ kind: "idle" });
    }
  }, [bookingDate, selectedRoomOpeningDateRange]);

  const selectedStartIso = bookingDate && startTime ? localDateAndTimeToIso(bookingDate, startTime) : null;
  const selectedEndIso = bookingDate && endTime ? localDateAndTimeToIso(bookingDate, endTime) : null;
  const selectedTimeValidation = useMemo<SelectedTimeValidation | null>(() => {
    if (!startTime || !endTime || !selectedStartIso || !selectedEndIso) {
      return null;
    }

    const openingStartMinutes = parseTimeToMinutes(selectedRoomOpeningStartTime);
    const openingEndMinutes = parseTimeToMinutes(selectedRoomOpeningEndTime);
    if (openingStartMinutes === null || openingEndMinutes === null) {
      return null;
    }
    if (new Date(selectedEndIso).getTime() <= new Date(selectedStartIso).getTime()) {
      return { message: bookingErrorMessages.invalid_time_range, conflictingBookingIds: new Set<string>() };
    }

    const selectedStartDate = getZonedDateString(selectedStartIso);
    const selectedEndDate = getZonedDateString(selectedEndIso);
    if (
      selectedStartDate !== selectedEndDate ||
      !isDateWithinOpeningRange(selectedStartDate, selectedRoomOpeningDateRange) ||
      !isDateWithinOpeningRange(selectedEndDate, selectedRoomOpeningDateRange)
    ) {
      return { message: outOfOpeningDatesMessage, conflictingBookingIds: new Set<string>() };
    }

    const selectedStartMinutes = getZonedMinutesSinceMidnight(selectedStartIso);
    const selectedEndMinutes = getZonedMinutesSinceMidnight(selectedEndIso);
    if (selectedStartMinutes < openingStartMinutes || selectedEndMinutes > openingEndMinutes) {
      return { message: outOfOpeningTimeMessage, conflictingBookingIds: new Set<string>() };
    }

    const duration = minutesBetween(selectedStartIso, selectedEndIso);
    if (duration < (selectedRoom?.minDurationMinutes ?? 1)) {
      return { message: bookingErrorMessages.duration_too_short, conflictingBookingIds: new Set<string>() };
    }
    if (duration > (selectedRoom?.maxDurationMinutes ?? 24 * 60)) {
      return { message: bookingErrorMessages.duration_too_long, conflictingBookingIds: new Set<string>() };
    }

    const directConflictIds = new Set(
      bookings
        .filter((booking) => overlaps(booking.startTime, booking.endTime, selectedStartIso, selectedEndIso))
        .map((booking) => booking.id),
    );
    if (directConflictIds.size > 0) {
      return { message: selectedConflictMessage, conflictingBookingIds: directConflictIds };
    }

    const bufferMinutes = Number.isInteger(selectedRoom?.bufferMinutes) && (selectedRoom?.bufferMinutes ?? 0) > 0
      ? selectedRoom?.bufferMinutes ?? 0
      : 0;
    const bufferConflictIds = new Set(
      bookings
        .filter((booking) =>
          overlaps(
            booking.startTime,
            booking.endTime,
            addMinutes(selectedStartIso, -bufferMinutes),
            addMinutes(selectedEndIso, bufferMinutes),
          ),
        )
        .map((booking) => booking.id),
    );
    if (bufferConflictIds.size > 0) {
      return { message: selectedBufferConflictMessage, conflictingBookingIds: bufferConflictIds };
    }

    return null;
  }, [
    bookings,
    endTime,
    selectedEndIso,
    selectedRoom?.bufferMinutes,
    selectedRoom?.maxDurationMinutes,
    selectedRoom?.minDurationMinutes,
    selectedRoomOpeningEndTime,
    selectedRoomOpeningStartTime,
    selectedStartIso,
    startTime,
  ]);
  const conflictingBookingIds = selectedTimeValidation?.conflictingBookingIds ?? new Set<string>();
  const hasSelectedTimeError = selectedTimeValidation !== null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    const roomId = String(form.get("roomId") ?? "");
    const title = String(form.get("title") ?? "");
    const contactName = String(form.get("contactName") ?? "");
    const email = String(form.get("email") ?? "").trim();

    if (!roomId || !title || !contactName || !email || !bookingDate || !startTime || !endTime) {
      setEmailHasFormatError(false);
      setSubmitState({ kind: "error", message: "Please fill in all required fields." });
      return;
    }
    if (!isValidEmailFormat(email)) {
      setEmailHasFormatError(true);
      setSubmitState({ kind: "error", message: invalidEmailMessage });
      return;
    }
    setEmailHasFormatError(false);
    if (!isDateWithinOpeningRange(bookingDate, selectedRoomOpeningDateRange)) {
      setSubmitState({ kind: "error", message: outOfOpeningDatesMessage });
      return;
    }

    const startIso = localDateAndTimeToIso(bookingDate, startTime);
    const endIso = localDateAndTimeToIso(bookingDate, endTime);
    if (!startIso || !endIso) {
      setSubmitState({ kind: "error", message: bookingErrorMessages.invalid_time_range });
      return;
    }
    if (selectedTimeValidation) {
      return;
    }

    setSubmitState({ kind: "submitting" });

    try {
      const payload = {
        roomId,
        title,
        contactName,
        email,
        startTime: startIso,
        endTime: endIso,
      };
      const result = linkToken ? await api.createBookingWithLink(linkToken, payload) : await api.createBooking(payload);

      const message =
        result.status === "confirmed"
          ? "Booking confirmed. We've reserved the room for you."
          : "Booking submitted. An administrator will review and confirm shortly.";
      setSubmitState({ kind: "success", message });
      formEl.reset();
      setBookingDate("");
      setStartTime("");
      setEndTime("");
    } catch (error) {
      if (error instanceof ApiError && error.errorCode && bookingErrorMessages[error.errorCode]) {
        setSubmitState({
          kind: "error",
          message: bookingErrorMessages[error.errorCode],
        });
      } else {
        setSubmitState({ kind: "error", message: "Booking failed." });
      }
    }
  }

  return (
    <main className={embedded ? "embedded-page" : "app-shell"}>
      <header className="page-header">
        <div>
          <h1>Book a Meeting Room</h1>
          {selectedRoom ? (
            <p>{formatOpeningHours(selectedRoom.openingHours) ?? "Reserve a room by selecting a time and providing your contact details."}</p>
          ) : (
            <p>Select a room to view opening hours.</p>
          )}
        </div>
        {embedded && onBack ? (
          <button className="button button--secondary" type="button" onClick={onBack}>
            Back to room status
          </button>
        ) : null}
      </header>

      {roomsError ? <p className="form-message form-message--error">{roomsError}</p> : null}

      <form className="booking-form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <label htmlFor="roomId">Room *</label>
          <select
            id="roomId"
            name="roomId"
            required
            value={selectedRoomId}
            onChange={(event) => {
              setSelectedRoomId(event.target.value);
              setStartTime("");
              setEndTime("");
              setSubmitState({ kind: "idle" });
            }}
          >
            <option value="" disabled>
              Select a room
            </option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
                {room.location ? ` — ${room.location}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="title">Meeting title *</label>
          <input id="title" name="title" type="text" maxLength={120} required />
        </div>

        <div className="form-row">
          <label htmlFor="contactName">Contact name *</label>
          <input id="contactName" name="contactName" type="text" maxLength={80} required />
        </div>

        <div className="form-row">
          <label htmlFor="email">Email *</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            aria-invalid={emailHasFormatError ? "true" : undefined}
            onChange={() => {
              if (emailHasFormatError) {
                setEmailHasFormatError(false);
                setSubmitState({ kind: "idle" });
              }
            }}
          />
        </div>

        <div className="form-row">
          <label htmlFor="bookingDate">Booking date *</label>
          <input
            id="bookingDate"
            name="bookingDate"
            type="date"
            required
            min={selectedRoomOpeningDateRange?.startDate}
            max={selectedRoomOpeningDateRange?.endDate}
            value={bookingDate}
            onChange={(event) => {
              setBookingDate(event.target.value);
              setStartTime("");
              setEndTime("");
              setSubmitState({ kind: "idle" });
            }}
          />
          <p className="form-hint">{formatBookingGuidance(selectedRoom)}</p>
        </div>

        <div className="form-row">
          <label htmlFor="startTime">Start time *</label>
          <input
            className={`booking-time-input${hasSelectedTimeError ? " input--conflict" : ""}`}
            id="startTime"
            name="startTime"
            type="time"
            required
            step={bookingTimeSlotMinutes * 60}
            value={startTime}
            aria-invalid={hasSelectedTimeError ? "true" : undefined}
            onChange={(event) => {
              setStartTime(event.target.value);
              setSubmitState({ kind: "idle" });
            }}
          />
        </div>

        <div className="form-row">
          <label htmlFor="endTime">End time *</label>
          <input
            className={`booking-time-input${hasSelectedTimeError ? " input--conflict" : ""}`}
            id="endTime"
            name="endTime"
            type="time"
            required
            step={bookingTimeSlotMinutes * 60}
            value={endTime}
            aria-invalid={hasSelectedTimeError ? "true" : undefined}
            onChange={(event) => {
              setEndTime(event.target.value);
              setSubmitState({ kind: "idle" });
            }}
          />
        </div>

        {selectedTimeValidation ? (
          <p className="form-message form-message--error" role="alert">
            {selectedTimeValidation.message}
          </p>
        ) : null}

        <section className="room-schedule" aria-live="polite">
          <div className="room-schedule__header">
            <h2>Current room bookings</h2>
            <span>{bookingDate ? `${bookingDate} · ${BUSINESS_TIME_ZONE_LABEL}` : "Select a date"}</span>
          </div>
          {!selectedRoomId || !bookingDate ? (
            <p className="room-schedule__empty">Select a room and date to view existing bookings.</p>
          ) : bookingsLoading ? (
            <p className="room-schedule__empty">Loading bookings...</p>
          ) : bookingsError ? (
            <p className="room-schedule__empty room-schedule__empty--error">{bookingsError}</p>
          ) : bookings.length === 0 ? (
            <p className="room-schedule__empty">No bookings for this date.</p>
          ) : (
            <ul className="room-schedule__list">
              {bookings.map((booking, index) => {
                const isConflict = conflictingBookingIds.has(booking.id);
                return (
                  <li
                    className={`room-schedule__item${isConflict ? " room-schedule__item--conflict" : ""}`}
                    key={booking.id}
                  >
                    <strong>{`meeting${index + 1}`}</strong>
                    <span>
                      {formatBookingTime(booking.startTime, booking.endTime)} ·{" "}
                      {booking.status === "pending_approval" ? "Pending approval" : "Confirmed"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="form-actions">
          <button type="submit" disabled={submitState.kind === "submitting"}>
            {submitState.kind === "submitting" ? "Submitting..." : "Book room"}
          </button>
        </div>

        {submitState.kind === "success" ? (
          <p className="form-message form-message--success" role="status">
            {submitState.message}
          </p>
        ) : null}
        {submitState.kind === "error" ? (
          <p className="form-message form-message--error" role="alert">
            {submitState.message}
          </p>
        ) : null}
      </form>

      {!embedded ? (
        <p className="page-footnote">
          If you need to cancel or change a meeting, contact your meeting room administrator.
        </p>
      ) : null}
    </main>
  );
}
