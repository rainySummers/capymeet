import { useEffect, useMemo, useState } from "react";

import type { Room } from "../../shared/types";
import {
  BUSINESS_TIME_ZONE,
  formatBusinessTimeRange,
  formatBusinessTimeZoneLabel,
  getZonedDateString,
  getZonedMinutesSinceMidnight,
  minutesBetween,
  zonedDateTimeToUtc,
} from "../../shared/time";
import { api, ApiError, type PublicRoomBooking } from "../api";
import { loadPublicBusinessTimeZone } from "../businessTimeZone";
import { PublicLanguageToggle, usePublicI18n, type PublicLanguage } from "../i18n/publicI18n";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

type Translate = (key: string, values?: Record<string, string | number>) => string;

const bookingErrorKeys: Record<string, string> = {
  booking_conflict: "booking.error.booking_conflict",
  invalid_time_range: "booking.error.invalid_time_range",
  outside_opening_hours: "booking.error.outside_opening_hours",
  booking_too_far_in_advance: "booking.error.booking_too_far_in_advance",
  duration_too_short: "booking.error.duration_too_short",
  duration_too_long: "booking.error.duration_too_long",
  room_disabled: "booking.error.room_disabled",
  slot_interval_invalid: "booking.error.slot_interval_invalid",
};

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

function localDateAndTimeToIso(date: string, time: string, timeZone: string): string | null {
  try {
    return zonedDateTimeToUtc(date, time, timeZone).toISOString();
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

function formatBookingTime(startTime: string, endTime: string, timeZone: string): string {
  return formatBusinessTimeRange(startTime, endTime, timeZone);
}

function bookingErrorMessage(t: Translate, errorCode: string): string {
  return t(bookingErrorKeys[errorCode] ?? "booking.error.failed");
}

function formatOpeningDate(date: string, language: PublicLanguage): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function formatOpeningHours(
  openingHours: string,
  language: PublicLanguage,
  t: Translate,
  timeZoneLabel: string,
): string | null {
  const range = parseOpeningSchedule(openingHours);
  if (!range) {
    return null;
  }
  return t("booking.openingHours", {
    startDate: formatOpeningDate(range.startDate, language),
    endDate: formatOpeningDate(range.endDate, language),
    start: range.start,
    end: range.end,
    timeZone: timeZoneLabel,
  });
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function formatCount(value: number, unit: "day" | "minute", language: PublicLanguage): string {
  if (language === "zh") {
    return `${value} ${unit === "day" ? "天" : "分钟"}`;
  }
  const label = unit === "day"
    ? value === 1 ? "day" : "days"
    : value === 1 ? "minute" : "minutes";
  return `${value} ${label}`;
}

function formatBookingGuidance(
  room: Room | null,
  language: PublicLanguage,
  t: Translate,
  timeZoneLabel: string,
): string {
  const sentences = [t("booking.guidance.timeZone", { timeZone: timeZoneLabel })];

  if (!room) {
    sentences.push(t("booking.guidance.selectRoom"));
    return sentences.join(" ");
  }

  if (isPositiveInteger(room.minDurationMinutes)) {
    sentences.push(t("booking.guidance.minDuration", {
      duration: formatCount(room.minDurationMinutes, "minute", language),
    }));
  }
  if (isPositiveInteger(room.maxDurationMinutes)) {
    sentences.push(t("booking.guidance.maxDuration", {
      duration: formatCount(room.maxDurationMinutes, "minute", language),
    }));
  }
  if (isPositiveInteger(room.maxAdvanceDays)) {
    sentences.push(t("booking.guidance.maxAdvance", {
      duration: formatCount(room.maxAdvanceDays, "day", language),
    }));
  }
  if (isPositiveInteger(room.bufferMinutes)) {
    sentences.push(t("booking.guidance.buffer", { minutes: room.bufferMinutes }));
  } else if (room.bufferMinutes === 0) {
    sentences.push(t("booking.guidance.noBuffer"));
  }
  sentences.push(t(room.requiresApproval ? "booking.guidance.requiresApproval" : "booking.guidance.autoConfirm"));

  return sentences.join(" ");
}

type PublicBookingPageProps = {
  embedded?: boolean;
  initialRoomId?: string;
  linkToken?: string;
  onBack?: () => void;
};

export function PublicBookingPage({ embedded = false, linkToken, initialRoomId = "", onBack }: PublicBookingPageProps) {
  const { language, t } = usePublicI18n();
  const [businessTimeZone, setBusinessTimeZone] = useState(BUSINESS_TIME_ZONE);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState(initialRoomId);
  const [roomsError, setRoomsError] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({ kind: "idle" });
  const [bookingDate, setBookingDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [bookings, setBookings] = useState<PublicRoomBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState(false);
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
  const timeZoneLabel = formatBusinessTimeZoneLabel(businessTimeZone, language);

  useEffect(() => {
    let cancelled = false;
    loadPublicBusinessTimeZone().then((loadedBusinessTimeZone) => {
      if (!cancelled) {
        setBusinessTimeZone(loadedBusinessTimeZone);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadRooms = linkToken ? api.getBookingLink(linkToken) : api.listRooms();
    loadRooms
      .then((result) => {
        if (!cancelled) {
          setRooms(result.rooms);
          setRoomsError(false);
          setSelectedRoomId((current) =>
            current && result.rooms.some((room) => room.id === current) ? current : "",
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRoomsError(true);
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
      setBookingsError(false);
      setBookingsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setBookingsLoading(true);
    setBookingsError(false);
    setBookings([]);
    api
      .listPublicBookings(selectedRoomId, bookingDate, businessTimeZone)
      .then((result) => {
        if (!cancelled) {
          setBookings(result.bookings);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBookings([]);
          setBookingsError(true);
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
  }, [selectedRoomId, bookingDate, selectedRoomOpeningDateRange, businessTimeZone]);

  useEffect(() => {
    if (bookingDate && !isDateWithinOpeningRange(bookingDate, selectedRoomOpeningDateRange)) {
      setBookingDate("");
      setBookings([]);
      setSubmitState({ kind: "idle" });
    }
  }, [bookingDate, selectedRoomOpeningDateRange]);

  const selectedStartIso = bookingDate && startTime
    ? localDateAndTimeToIso(bookingDate, startTime, businessTimeZone)
    : null;
  const selectedEndIso = bookingDate && endTime
    ? localDateAndTimeToIso(bookingDate, endTime, businessTimeZone)
    : null;
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
      return { message: bookingErrorMessage(t, "invalid_time_range"), conflictingBookingIds: new Set<string>() };
    }

    const selectedStartDate = getZonedDateString(selectedStartIso, businessTimeZone);
    const selectedEndDate = getZonedDateString(selectedEndIso, businessTimeZone);
    if (
      selectedStartDate !== selectedEndDate ||
      !isDateWithinOpeningRange(selectedStartDate, selectedRoomOpeningDateRange) ||
      !isDateWithinOpeningRange(selectedEndDate, selectedRoomOpeningDateRange)
    ) {
      return { message: bookingErrorMessage(t, "outside_opening_hours"), conflictingBookingIds: new Set<string>() };
    }

    const selectedStartMinutes = getZonedMinutesSinceMidnight(selectedStartIso, businessTimeZone);
    const selectedEndMinutes = getZonedMinutesSinceMidnight(selectedEndIso, businessTimeZone);
    if (selectedStartMinutes < openingStartMinutes || selectedEndMinutes > openingEndMinutes) {
      return { message: t("booking.error.outOfOpeningTime"), conflictingBookingIds: new Set<string>() };
    }

    const duration = minutesBetween(selectedStartIso, selectedEndIso);
    if (duration < (selectedRoom?.minDurationMinutes ?? 1)) {
      return { message: bookingErrorMessage(t, "duration_too_short"), conflictingBookingIds: new Set<string>() };
    }
    if (duration > (selectedRoom?.maxDurationMinutes ?? 24 * 60)) {
      return { message: bookingErrorMessage(t, "duration_too_long"), conflictingBookingIds: new Set<string>() };
    }

    const directConflictIds = new Set(
      bookings
        .filter((booking) => overlaps(booking.startTime, booking.endTime, selectedStartIso, selectedEndIso))
        .map((booking) => booking.id),
    );
    if (directConflictIds.size > 0) {
      return { message: t("booking.error.selectedConflict"), conflictingBookingIds: directConflictIds };
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
      return { message: t("booking.error.selectedBufferConflict"), conflictingBookingIds: bufferConflictIds };
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
    businessTimeZone,
    t,
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
      setSubmitState({ kind: "error", message: t("booking.error.fillRequired") });
      return;
    }
    if (!isValidEmailFormat(email)) {
      setEmailHasFormatError(true);
      setSubmitState({ kind: "error", message: t("booking.error.invalidEmail") });
      return;
    }
    setEmailHasFormatError(false);
    if (!isDateWithinOpeningRange(bookingDate, selectedRoomOpeningDateRange)) {
      setSubmitState({ kind: "error", message: bookingErrorMessage(t, "outside_opening_hours") });
      return;
    }

    const startIso = localDateAndTimeToIso(bookingDate, startTime, businessTimeZone);
    const endIso = localDateAndTimeToIso(bookingDate, endTime, businessTimeZone);
    if (!startIso || !endIso) {
      setSubmitState({ kind: "error", message: bookingErrorMessage(t, "invalid_time_range") });
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
          ? t("booking.success.confirmed")
          : t("booking.success.pending");
      setSubmitState({ kind: "success", message });
      formEl.reset();
      setBookingDate("");
      setStartTime("");
      setEndTime("");
    } catch (error) {
      if (error instanceof ApiError && error.errorCode && bookingErrorKeys[error.errorCode]) {
        setSubmitState({
          kind: "error",
          message: bookingErrorMessage(t, error.errorCode),
        });
      } else {
        setSubmitState({ kind: "error", message: t("booking.error.failed") });
      }
    }
  }

  return (
    <main className={embedded ? "embedded-page" : "app-shell"}>
      <header className="page-header">
        <div>
          <h1>{t("booking.title")}</h1>
          {selectedRoom ? (
            <p>{formatOpeningHours(selectedRoom.openingHours, language, t, timeZoneLabel) ?? t("booking.defaultDescription")}</p>
          ) : (
            <p>{t("booking.selectRoomOpening")}</p>
          )}
        </div>
        <div className="page-header__actions">
          <PublicLanguageToggle />
          {embedded && onBack ? (
            <button className="button button--secondary" type="button" onClick={onBack}>
              {t("common.backToRoomStatus")}
            </button>
          ) : null}
        </div>
      </header>

      {roomsError ? <p className="form-message form-message--error">{t("booking.error.loadRooms")}</p> : null}

      <form className="booking-form" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <label htmlFor="roomId">{t("booking.room")}</label>
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
              {t("booking.selectRoom")}
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
          <label htmlFor="title">{t("booking.meetingTitle")}</label>
          <input id="title" name="title" type="text" maxLength={120} required />
        </div>

        <div className="form-row">
          <label htmlFor="contactName">{t("booking.contactName")}</label>
          <input id="contactName" name="contactName" type="text" maxLength={80} required />
        </div>

        <div className="form-row">
          <label htmlFor="email">{t("booking.email")}</label>
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
          <label htmlFor="bookingDate">{t("booking.date")}</label>
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
          <p className="form-hint">{formatBookingGuidance(selectedRoom, language, t, timeZoneLabel)}</p>
        </div>

        <div className="form-row">
          <label htmlFor="startTime">{t("booking.start")}</label>
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
          <label htmlFor="endTime">{t("booking.end")}</label>
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
            <h2>{t("booking.schedule.title")}</h2>
            <span>{bookingDate ? `${bookingDate} · ${timeZoneLabel}` : t("booking.schedule.selectDate")}</span>
          </div>
          {!selectedRoomId || !bookingDate ? (
            <p className="room-schedule__empty">{t("booking.schedule.emptyPrompt")}</p>
          ) : bookingsLoading ? (
            <p className="room-schedule__empty">{t("booking.schedule.loading")}</p>
          ) : bookingsError ? (
            <p className="room-schedule__empty room-schedule__empty--error">{t("booking.error.loadBookings")}</p>
          ) : bookings.length === 0 ? (
            <p className="room-schedule__empty">{t("booking.schedule.empty")}</p>
          ) : (
            <ul className="room-schedule__list">
              {bookings.map((booking, index) => {
                const isConflict = conflictingBookingIds.has(booking.id);
                return (
                  <li
                    className={`room-schedule__item${isConflict ? " room-schedule__item--conflict" : ""}`}
                    key={booking.id}
                  >
                    <strong>{t("booking.schedule.itemTitle", { count: index + 1 })}</strong>
                    <span>
                      {formatBookingTime(booking.startTime, booking.endTime, businessTimeZone)} ·{" "}
                      {booking.status === "pending_approval" ? t("status.pending_approval") : t("status.confirmed")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="form-actions">
          <button type="submit" disabled={submitState.kind === "submitting"}>
            {submitState.kind === "submitting" ? t("booking.submit.loading") : t("booking.submit.idle")}
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
          {t("booking.footnote")}
        </p>
      ) : null}
    </main>
  );
}
