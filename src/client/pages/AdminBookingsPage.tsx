import { useEffect, useMemo, useState } from "react";

import { AdminDrawer } from "../components/AdminDrawer";
import { AdminNav } from "../components/AdminNav";
import { ApiError, adminApi, type AdminBooking, type AdminBookingPayload } from "../api";
import type { BookingStatus, Room } from "../../shared/types";
import {
  BUSINESS_TIME_ZONE,
  formatBusinessDate,
  formatBusinessDateTime,
  formatBusinessTime,
  formatBusinessTimeZoneLabel,
  zonedDateTimeInputToUtcIso,
} from "../../shared/time";
import { loadAdminBusinessTimeZone } from "../businessTimeZone";
import { useAdminI18n } from "../i18n/adminI18n";

type LoadState = "loading" | "loaded" | "error";
type SortDirection = "asc" | "desc";

const emptyForm: AdminBookingPayload = {
  roomId: "",
  title: "",
  contactName: "",
  email: null,
  startTime: "",
  endTime: "",
};

export function localDateTimeToIso(value: string, timeZone = BUSINESS_TIME_ZONE): string {
  return zonedDateTimeInputToUtcIso(value, timeZone);
}

function createBookingErrorMessage(error: unknown, t: (key: string) => string): string {
  if (error instanceof ApiError) {
    switch (error.errorCode) {
      case "invalid_time_range":
      case "outside_opening_hours":
      case "booking_too_far_in_advance":
      case "duration_too_short":
      case "duration_too_long":
      case "booking_conflict":
      case "room_disabled":
        return t(`bookings.createError.${error.errorCode}`);
      default:
        break;
    }
  }
  return t("bookings.createError");
}

function formatDateTime(value: string, timeZone: string): string {
  return formatBusinessDateTime(value, "en-US", timeZone);
}

function formatDate(value: string, timeZone: string): string {
  return formatBusinessDate(value, "en-US", { year: "numeric", month: "short", day: "numeric" }, timeZone);
}

function formatTime(value: string, timeZone: string): string {
  return formatBusinessTime(value, timeZone);
}

function bookingStatusClass(status: BookingStatus): string {
  switch (status) {
    case "confirmed":
      return "success";
    case "pending_approval":
      return "warning";
    case "rejected":
      return "danger";
    case "cancelled":
    case "completed":
      return "muted";
    default:
      return "warning";
  }
}

export function AdminBookingsPage() {
  const { t, language } = useAdminI18n();
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [businessTimeZone, setBusinessTimeZone] = useState(BUSINESS_TIME_ZONE);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [form, setForm] = useState<AdminBookingPayload>(emptyForm);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRoomPickerOpen, setIsRoomPickerOpen] = useState(false);
  const [selectedRoomForBooking, setSelectedRoomForBooking] = useState("");
  const [lockedRoomId, setLockedRoomId] = useState("");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [roomFilter, setRoomFilter] = useState("");
  const [message, setMessage] = useState("");
  const timeZoneLabel = formatBusinessTimeZoneLabel(businessTimeZone, language);

  const visibleBookings = useMemo(() => {
    return bookings
      .filter((booking) => !roomFilter || booking.roomId === roomFilter)
      .sort((a, b) => {
      const difference = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      return sortDirection === "asc" ? difference : -difference;
    });
  }, [bookings, roomFilter, sortDirection]);

  async function load() {
    setLoadState("loading");
    const [data, loadedBusinessTimeZone] = await Promise.all([
      adminApi.listBookings(),
      loadAdminBusinessTimeZone(),
    ]);
    setBookings(data.bookings);
    setRooms(data.rooms);
    setBusinessTimeZone(loadedBusinessTimeZone);
    setLoadState("loaded");
  }

  useEffect(() => {
    load().catch(() => {
      setBookings([]);
      setRooms([]);
      setLoadState("error");
    });
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      await adminApi.createBooking({
        ...form,
        email: form.email || null,
        startTime: localDateTimeToIso(form.startTime, businessTimeZone),
        endTime: localDateTimeToIso(form.endTime, businessTimeZone),
      });
      setForm(emptyForm);
      setIsDrawerOpen(false);
      setLockedRoomId("");
      setMessage(t("bookings.created"));
      await load();
    } catch (error) {
      setMessage(createBookingErrorMessage(error, t));
    }
  }

  async function cancel(id: string) {
    setMessage("");
    try {
      await adminApi.cancelBooking(id);
      setMessage(t("bookings.cancelled"));
      await load();
    } catch {
      setMessage(t("bookings.cancelError"));
    }
  }

  async function deleteBooking(id: string) {
    if (!window.confirm(t("bookings.deleteConfirm"))) {
      return;
    }
    setMessage("");
    try {
      await adminApi.deleteBooking(id);
      setMessage(t("bookings.deleted"));
      await load();
    } catch {
      setMessage(t("bookings.deleteError"));
    }
  }

  function openRoomPicker() {
    setSelectedRoomForBooking("");
    setForm(emptyForm);
    setLockedRoomId("");
    setIsRoomPickerOpen(true);
    setMessage("");
  }

  function continueToBookingForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoomForBooking) {
      return;
    }
    setForm({ ...emptyForm, roomId: selectedRoomForBooking });
    setLockedRoomId(selectedRoomForBooking);
    setIsRoomPickerOpen(false);
    setIsDrawerOpen(true);
  }

  function closeBookingDrawer() {
    setForm(emptyForm);
    setLockedRoomId("");
    setIsDrawerOpen(false);
  }

  return (
    <section className="admin-layout">
      <AdminNav />

      <main className="admin-main">
        <header className="page-header">
          <div>
            <h1>{t("bookings.title")}</h1>
            <p>{t("bookings.subtitle")}</p>
          </div>
          <button
            className="button button--primary"
            type="button"
            onClick={openRoomPicker}
          >
            {t("bookings.new")}
          </button>
        </header>

        {message ? <p className="form-message">{message}</p> : null}
        {loadState === "loading" ? <p className="form-message">{t("bookings.loading")}</p> : null}
        {loadState === "error" ? (
          <p className="form-message form-message--error" role="alert">
            {t("bookings.loadError")}
          </p>
        ) : null}
        {loadState === "loaded" && bookings.length === 0 ? <p className="page-footnote">{t("bookings.empty")}</p> : null}

        {bookings.length > 0 ? (
          <div className="admin-toolbar">
            <label className="admin-toolbar__control" htmlFor="bookings-room-filter">
              <span>{t("bookings.roomFilterLabel")}</span>
              <select id="bookings-room-filter" value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)}>
                <option value="">{t("bookings.roomFilterAll")}</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-toolbar__control" htmlFor="bookings-sort">
              <span>{t("bookings.sortLabel")}</span>
              <select
                id="bookings-sort"
                value={sortDirection}
                onChange={(event) => setSortDirection(event.target.value as SortDirection)}
              >
                <option value="asc">{t("bookings.sortAsc")}</option>
                <option value="desc">{t("bookings.sortDesc")}</option>
              </select>
            </label>
          </div>
        ) : null}

        {bookings.length > 0 ? (
          <div className="admin-list" aria-label={t("bookings.listLabel")}>
            {visibleBookings.map((booking) => (
              <article className="list-row list-row--stacked" key={booking.id}>
                <div className="booking-time-card">
                  <span>{t("bookings.meetingTime")}</span>
                  <strong>
                    {formatTime(booking.startTime, businessTimeZone)} - {formatTime(booking.endTime, businessTimeZone)}
                  </strong>
                  <small>{formatDate(booking.startTime, businessTimeZone)} · {timeZoneLabel}</small>
                </div>
                <div className="booking-room-card">
                  <span>{t("bookings.meetingRoom")}</span>
                  <strong>{booking.roomName ?? booking.roomId}</strong>
                  {booking.roomLocation ? <small>{booking.roomLocation}</small> : null}
                </div>
                <div className="list-row__content">
                  <strong>{booking.title}</strong>
                  <p>
                    {formatDateTime(booking.startTime, businessTimeZone)} -{" "}
                    {formatDateTime(booking.endTime, businessTimeZone)}
                  </p>
                  <p>
                    {booking.contactName}
                    {booking.email ? ` · ${booking.email}` : ""} · {t(`status.${booking.status}`)}
                  </p>
                </div>
                <span className={`status-badge status-badge--${bookingStatusClass(booking.status)}`}>
                  {t(`status.${booking.status}`)}
                </span>
                <div className="row-actions">
                  {booking.status === "confirmed" || booking.status === "pending_approval" ? (
                    <button className="button button--secondary" type="button" onClick={() => cancel(booking.id)}>
                      {t("bookings.cancel")}
                    </button>
                  ) : null}
                  <button className="button button--danger" type="button" onClick={() => deleteBooking(booking.id)}>
                    {t("bookings.delete")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <AdminDrawer
          title={t("bookings.selectRoomTitle")}
          description={t("bookings.selectRoomDescription")}
          isOpen={isRoomPickerOpen}
          onClose={() => setIsRoomPickerOpen(false)}
        >
          <form className="booking-form admin-form-grid" onSubmit={continueToBookingForm}>
            <div className="form-row">
              <label htmlFor="booking-room-picker">{t("bookings.room")}</label>
              <select
                id="booking-room-picker"
                value={selectedRoomForBooking}
                onChange={(event) => setSelectedRoomForBooking(event.target.value)}
                required
              >
                <option value="">{t("bookings.selectRoom")}</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-actions">
              <button className="button button--primary" type="submit">
                {t("bookings.continue")}
              </button>
            </div>
          </form>
        </AdminDrawer>

        <AdminDrawer
          title={t("bookings.new")}
          description={t("bookings.drawerDescription")}
          isOpen={isDrawerOpen}
          onClose={closeBookingDrawer}
        >
          <form className="booking-form admin-form-grid" onSubmit={submit}>
            <div className="form-row">
              <label htmlFor="booking-room">{t("bookings.room")}</label>
              <select
                id="booking-room"
                value={form.roomId}
                onChange={(event) => setForm({ ...form, roomId: event.target.value })}
                disabled={Boolean(lockedRoomId)}
                required
              >
                <option value="">{t("bookings.selectRoom")}</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label htmlFor="booking-title">{t("bookings.meetingTitle")}</label>
              <input
                id="booking-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="booking-contact">{t("bookings.contact")}</label>
              <input
                id="booking-contact"
                value={form.contactName}
                onChange={(event) => setForm({ ...form, contactName: event.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="booking-email">{t("bookings.email")}</label>
              <input
                id="booking-email"
                type="email"
                value={form.email ?? ""}
                onChange={(event) => setForm({ ...form, email: event.target.value || null })}
              />
            </div>
            <div className="form-row">
              <label htmlFor="booking-start">{t("bookings.start")}</label>
              <input
                id="booking-start"
                type="datetime-local"
                value={form.startTime}
                onChange={(event) => setForm({ ...form, startTime: event.target.value })}
                required
              />
              <p className="form-hint">{t("bookings.timeZoneHint", { timeZone: timeZoneLabel })}</p>
            </div>
            <div className="form-row">
              <label htmlFor="booking-end">{t("bookings.end")}</label>
              <input
                id="booking-end"
                type="datetime-local"
                value={form.endTime}
                onChange={(event) => setForm({ ...form, endTime: event.target.value })}
                required
              />
              <p className="form-hint">{t("bookings.timeZoneHint", { timeZone: timeZoneLabel })}</p>
            </div>
            <div className="form-actions">
              <button className="button button--primary" type="submit">
                {t("bookings.new")}
              </button>
            </div>
          </form>
        </AdminDrawer>
      </main>
    </section>
  );
}
