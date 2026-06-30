import { useEffect, useState } from "react";

import type { Room } from "../../shared/types";
import { AdminNav } from "../components/AdminNav";
import { adminApi, type AdminBooking } from "../api";
import { loadAdminBusinessTimeZone } from "../businessTimeZone";
import { useAdminI18n } from "../i18n/adminI18n";
import {
  BUSINESS_TIME_ZONE,
  BUSINESS_TIME_ZONE_OPTIONS,
  formatBusinessDate,
  formatBusinessTime,
  formatBusinessTimeZoneLabel,
  getZonedDateString,
} from "../../shared/time";

type LoadState = "loading" | "loaded" | "error";
const activeBookingStatuses = new Set(["confirmed", "pending_approval"]);
const upcomingPreviewCount = 3;
const dateLocaleByLanguage = {
  en: "en-US",
  zh: "zh-CN",
} as const;

function isSameLocalDay(value: string, reference: Date, timeZone: string): boolean {
  return getZonedDateString(value, timeZone) === getZonedDateString(reference, timeZone);
}

function formatTime(value: string, timeZone: string): string {
  return formatBusinessTime(value, timeZone);
}

function formatDateTimeRange(startTime: string, endTime: string, locale: string, timeZone: string): string {
  const date = formatBusinessDate(startTime, locale, { month: "short", day: "numeric" }, timeZone);
  return `${date}, ${formatTime(startTime, timeZone)} - ${formatTime(endTime, timeZone)}`;
}

function isActiveBooking(booking: AdminBooking): boolean {
  return activeBookingStatuses.has(booking.status);
}

function roomBookings(roomId: string, bookings: AdminBooking[], now: Date, timeZone: string): AdminBooking[] {
  return bookings
    .filter((booking) => booking.roomId === roomId && isSameLocalDay(booking.startTime, now, timeZone))
    .filter(isActiveBooking)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

function upcomingRoomBookings(roomId: string, bookings: AdminBooking[], now: Date): AdminBooking[] {
  return bookings
    .filter((booking) => booking.roomId === roomId)
    .filter(isActiveBooking)
    .filter((booking) => new Date(booking.endTime).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}

function getRoomStatus(room: Room, bookings: AdminBooking[], now: Date, timeZone: string) {
  const todayBookings = roomBookings(room.id, bookings, now, timeZone);
  const current = todayBookings.find(
    (booking) =>
      booking.status === "confirmed" && new Date(booking.startTime) <= now && new Date(booking.endTime) > now,
  );
  const next = todayBookings.find((booking) => booking.status === "confirmed" && new Date(booking.startTime) > now);
  const pendingCount = todayBookings.filter((booking) => booking.status === "pending_approval").length;

  if (!room.isEnabled) {
    return { labelKey: "dashboard.statusDisabled", tone: "muted", todayBookings, current, next, pendingCount };
  }
  if (current) {
    return { labelKey: "dashboard.statusInUse", tone: "danger", todayBookings, current, next, pendingCount };
  }
  if (pendingCount > 0) {
    return { labelKey: "dashboard.statusPending", tone: "warning", todayBookings, current, next, pendingCount };
  }
  return { labelKey: "dashboard.statusAvailable", tone: "success", todayBookings, current, next, pendingCount };
}

export function AdminDashboardPage() {
  const { t, language } = useAdminI18n();
  const dateLocale = dateLocaleByLanguage[language];
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [businessTimeZone, setBusinessTimeZone] = useState(BUSINESS_TIME_ZONE);
  const [timeZoneMessage, setTimeZoneMessage] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [expandedRoomIds, setExpandedRoomIds] = useState<Set<string>>(() => new Set());
  const timeZoneLabel = formatBusinessTimeZoneLabel(businessTimeZone, language);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");

    Promise.all([
      adminApi.listRooms(),
      adminApi.listBookings(),
      loadAdminBusinessTimeZone(),
    ])
      .then(([roomData, bookingData, loadedBusinessTimeZone]) => {
        if (cancelled) {
          return;
        }
        setRooms(roomData.rooms);
        setBookings(bookingData.bookings);
        setBusinessTimeZone(loadedBusinessTimeZone);
        setLoadState("loaded");
      })
      .catch(() => {
        if (!cancelled) {
          setRooms([]);
          setBookings([]);
          setLoadState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function updateBusinessTimeZone(nextTimeZone: string) {
    const previousTimeZone = businessTimeZone;
    setBusinessTimeZone(nextTimeZone);
    setTimeZoneMessage("");
    try {
      const data = await adminApi.updateBusinessSettings({ businessTimeZone: nextTimeZone });
      setBusinessTimeZone(data.settings.businessTimeZone);
      setTimeZoneMessage(t("dashboard.timeZoneSaved"));
    } catch {
      setBusinessTimeZone(previousTimeZone);
      setTimeZoneMessage(t("dashboard.timeZoneSaveError"));
    }
  }

  return (
    <section className="admin-layout">
      <AdminNav />

      <main className="admin-main">
        <header className="page-header">
          <div>
            <h1>{t("dashboard.title")}</h1>
            <p>{t("dashboard.subtitle")}</p>
          </div>
          <div className="page-header__actions">
            <label className="admin-toolbar__control" htmlFor="dashboard-business-time-zone">
              <span>{t("dashboard.timeZoneLabel")}</span>
              <select
                id="dashboard-business-time-zone"
                value={businessTimeZone}
                onChange={(event) => void updateBusinessTimeZone(event.target.value)}
              >
                {BUSINESS_TIME_ZONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {formatBusinessTimeZoneLabel(option.value, language)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </header>

        {timeZoneMessage ? <p className="form-message">{timeZoneMessage}</p> : null}
        {loadState === "loading" ? <p className="form-message">{t("dashboard.loading")}</p> : null}
        {loadState === "error" ? (
          <p className="form-message form-message--error" role="alert">
            {t("dashboard.error")}
          </p>
        ) : null}

        {loadState === "loaded" && rooms.length === 0 ? (
          <p className="page-footnote">{t("dashboard.empty")}</p>
        ) : null}

        {rooms.length > 0 ? (
          <div className="dashboard-grid" aria-label={t("dashboard.listLabel")}>
            {rooms.map((room) => {
              const now = new Date();
              const status = getRoomStatus(room, bookings, now, businessTimeZone);
              const upcomingBookings = upcomingRoomBookings(room.id, bookings, now);
              const isExpanded = expandedRoomIds.has(room.id);
              const visibleUpcomingBookings = isExpanded
                ? upcomingBookings
                : upcomingBookings.slice(0, upcomingPreviewCount);
              const canExpand = upcomingBookings.length > upcomingPreviewCount;
              return (
              <article className="dashboard-card" key={room.id}>
                <div className="dashboard-card__header">
                  <div>
                    <h2>{room.name}</h2>
                    <p>{room.location || t("dashboard.locationEmpty")}</p>
                  </div>
                  <span className={`status-badge status-badge--${status.tone}`}>{t(status.labelKey)}</span>
                </div>
                <div className="dashboard-card__body">
                  <p>
                    {status.current
                      ? t("dashboard.now", { title: status.current.title })
                      : t("dashboard.nowAvailable")}
                  </p>
                  <p>
                    {status.next
                      ? t("dashboard.next", { title: status.next.title })
                      : status.current
                        ? t("dashboard.nextNoneAfterCurrent")
                        : t("dashboard.nextNone")}
                  </p>
                </div>
                <div className="metric-row">
                  <span>{t("dashboard.today", { count: status.todayBookings.length })}</span>
                  <span>{t("dashboard.pending", { count: status.pendingCount })}</span>
                  {status.next ? <span>{formatTime(status.next.startTime, businessTimeZone)} · {timeZoneLabel}</span> : null}
                </div>
                <section className="dashboard-upcoming" aria-label={`${room.name} upcoming bookings`}>
                  <div className="dashboard-upcoming__header">
                    <h3>{t("dashboard.upcomingTitle")}</h3>
                    {canExpand ? (
                      <button
                        className="button button--ghost dashboard-upcoming__toggle"
                        type="button"
                        onClick={() =>
                          setExpandedRoomIds((current) => {
                            const next = new Set(current);
                            if (next.has(room.id)) {
                              next.delete(room.id);
                            } else {
                              next.add(room.id);
                            }
                            return next;
                          })
                        }
                      >
                        {isExpanded ? t("dashboard.upcomingCollapse") : t("dashboard.upcomingShowAll")}
                      </button>
                    ) : null}
                  </div>
                  {visibleUpcomingBookings.length > 0 ? (
                    <ul className="dashboard-upcoming__list">
                      {visibleUpcomingBookings.map((booking) => (
                        <li className="dashboard-upcoming__item" key={booking.id}>
                          <strong>{booking.title}</strong>
                          <span>
                            {formatDateTimeRange(booking.startTime, booking.endTime, dateLocale, businessTimeZone)} ·{" "}
                            {timeZoneLabel}
                          </span>
                          <span>
                            {booking.contactName} · {t(`status.${booking.status}`)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="dashboard-upcoming__empty">{t("dashboard.upcomingEmpty")}</p>
                  )}
                </section>
              </article>
              );
            })}
          </div>
        ) : null}
      </main>
    </section>
  );
}
