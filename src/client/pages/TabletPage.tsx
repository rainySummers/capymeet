import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode/lib/browser";

import type { Room } from "../../shared/types";
import {
  BUSINESS_TIME_ZONE,
  formatBusinessTimeRange,
  formatBusinessTimeZoneLabel,
  getZonedDateString,
} from "../../shared/time";
import { api, type PublicRoomBooking } from "../api";
import { loadPublicBusinessTimeZone } from "../businessTimeZone";
import capymeetLogo from "../assets/capymeet-logo.png";
import { PublicLanguageToggle, usePublicI18n } from "../i18n/publicI18n";

type LoadState = "loading" | "loaded" | "error";
type BookingTimeState = "current" | "upcoming" | "past";

const TABLET_REFRESH_MS = 10000;
const TABLET_IDLE_RETURN_MS = 10000;

type Translate = (key: string, values?: Record<string, string | number>) => string;

function todayDateString(timeZone: string): string {
  return getZonedDateString(new Date(Date.now()), timeZone);
}

function formatBookingTime(startTime: string, endTime: string, timeZone: string): string {
  return formatBusinessTimeRange(startTime, endTime, timeZone);
}

function isConfirmedBooking(booking: PublicRoomBooking): boolean {
  return booking.status === "confirmed";
}

function getBookingTimeState(booking: PublicRoomBooking, currentTime: number): BookingTimeState {
  const startTime = new Date(booking.startTime).getTime();
  const endTime = new Date(booking.endTime).getTime();
  if (startTime <= currentTime && currentTime < endTime) {
    return "current";
  }
  return currentTime < startTime ? "upcoming" : "past";
}

function bookingTimeStateLabel(timeState: BookingTimeState, t: Translate): string {
  if (timeState === "current") {
    return t("tablet.timeState.current");
  }
  return timeState === "past" ? t("tablet.timeState.past") : t("tablet.timeState.upcoming");
}

function roomCapacityLabel(room: Room | null, t: Translate): string | null {
  if (!room?.capacity) {
    return null;
  }
  return t(room.capacity === 1 ? "tablet.capacity.person" : "tablet.capacity.people", { count: room.capacity });
}

export function TabletPage({ deviceCode }: { deviceCode: string }) {
  const { language, t } = usePublicI18n();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [businessTimeZone, setBusinessTimeZone] = useState(BUSINESS_TIME_ZONE);
  const [defaultRoomId, setDefaultRoomId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [bookings, setBookings] = useState<PublicRoomBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [refreshTick, setRefreshTick] = useState(0);
  const [roomActivityTick, setRoomActivityTick] = useState(0);
  const [bookingQrCode, setBookingQrCode] = useState<string | null>(null);
  const bookingsRoomIdRef = useRef<string | null>(null);
  const timeZoneLabel = formatBusinessTimeZoneLabel(businessTimeZone, language);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );
  const selectedRoomCapacityLabel = roomCapacityLabel(selectedRoom, t);
  const confirmedBookings = useMemo(() => bookings.filter(isConfirmedBooking), [bookings]);
  const currentBooking = useMemo(
    () =>
      confirmedBookings.find((booking) => getBookingTimeState(booking, currentTime) === "current") ?? null,
    [confirmedBookings, currentTime],
  );
  const sortedBookings = useMemo(
    () =>
      [...confirmedBookings].sort((a, b) => {
        const startDifference = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        if (startDifference !== 0) {
          return startDifference;
        }
        return new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
      }),
    [confirmedBookings],
  );
  const bookingUrl = useMemo(() => {
    if (!selectedRoomId) {
      return "";
    }
    return `${window.location.origin}/?roomId=${encodeURIComponent(selectedRoomId)}`;
  }, [selectedRoomId]);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");

    Promise.all([api.getTablet(deviceCode), loadPublicBusinessTimeZone()])
      .then(([data, loadedBusinessTimeZone]) => {
        if (cancelled) {
          return;
        }
        const roomId = data.defaultRoom?.id ?? data.rooms[0]?.id ?? "";
        setBusinessTimeZone(loadedBusinessTimeZone);
        setRooms(data.rooms);
        setDefaultRoomId(roomId);
        setSelectedRoomId(roomId);
        setLoadState("loaded");
      })
      .catch(() => {
        if (!cancelled) {
          setRooms([]);
          setDefaultRoomId("");
          setSelectedRoomId("");
          setLoadState("error");
        }
      });

    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
      setRefreshTick((tick) => tick + 1);
      void api.sendHeartbeat(deviceCode).catch(() => undefined);
    }, TABLET_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [deviceCode]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedRoomId) {
      setBookings([]);
      setBookingsError(false);
      setBookingsLoading(false);
      bookingsRoomIdRef.current = null;
      return () => {
        cancelled = true;
      };
    }

    const canKeepExistingBookings = bookingsRoomIdRef.current === selectedRoomId;
    if (!canKeepExistingBookings) {
      setBookings([]);
    }
    setBookingsLoading(true);
    setBookingsError(false);
    api
      .listPublicBookings(selectedRoomId, todayDateString(businessTimeZone), businessTimeZone)
      .then((result) => {
        if (!cancelled) {
          bookingsRoomIdRef.current = selectedRoomId;
          setBookings(result.bookings);
        }
      })
      .catch(() => {
        if (!cancelled) {
          if (!canKeepExistingBookings) {
            setBookings([]);
          }
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
  }, [businessTimeZone, refreshTick, selectedRoomId]);

  useEffect(() => {
    if (!defaultRoomId || selectedRoomId === defaultRoomId) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSelectedRoomId(defaultRoomId);
      setCurrentTime(Date.now());
      setRefreshTick((tick) => tick + 1);
    }, TABLET_IDLE_RETURN_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [defaultRoomId, roomActivityTick, selectedRoomId]);

  useEffect(() => {
    let cancelled = false;
    if (!bookingUrl) {
      setBookingQrCode(null);
      return () => {
        cancelled = true;
      };
    }

    setBookingQrCode(null);
    QRCode.toString(bookingUrl, { type: "svg", margin: 1, width: 256 })
      .then((svg) => {
        if (!cancelled) {
          setBookingQrCode(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBookingQrCode(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bookingUrl]);

  function recordTabletActivity() {
    setRoomActivityTick((tick) => tick + 1);
  }

  if (loadState === "loading") {
    return (
      <section className="tablet">
        <PublicLanguageToggle className="tablet-language-toggle tablet-language-toggle--floating" />
        <p className="tablet-message">{t("tablet.loading")}</p>
      </section>
    );
  }

  if (loadState === "error") {
    return (
      <section className="tablet">
        <PublicLanguageToggle className="tablet-language-toggle tablet-language-toggle--floating" />
        <p className="tablet-message tablet-message--error" role="alert">
          {t("tablet.error")}
        </p>
      </section>
    );
  }

  return (
    <section
      className="tablet"
      onChangeCapture={recordTabletActivity}
      onKeyDownCapture={recordTabletActivity}
      onPointerDownCapture={recordTabletActivity}
    >
      <div className="tablet-layout">
        <main className="tablet-main-panel" aria-label={t("tablet.roomStatus")}>
          <header className="tablet-header">
            <div className="tablet-header-top">
              <div className="tablet-logo-surface">
                <img className="tablet-company-logo" src={capymeetLogo} alt={t("tablet.logoAlt")} />
              </div>
              <div className="tablet-header-actions">
                <PublicLanguageToggle className="tablet-language-toggle" />
                {rooms.length > 0 ? (
                  <label className="tablet-switcher">
                    <span>{t("tablet.switchRoom")}</span>
                    <select value={selectedRoomId} onChange={(event) => setSelectedRoomId(event.target.value)}>
                      {rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            </div>
            <div className="tablet-room-heading">
              <p className="tablet-room-kicker">{t("tablet.roomKicker")}</p>
              <div className="tablet-room-title">
                <h1>{selectedRoom?.name ?? t("tablet.noRoom")}</h1>
                {selectedRoomCapacityLabel ? (
                  <span className="tablet-room-capacity">{selectedRoomCapacityLabel}</span>
                ) : null}
              </div>
            </div>
          </header>

          <div className={`status-panel ${currentBooking ? "in-use" : "available"}`} aria-live="polite">
            <span>{currentBooking ? t("tablet.status.inUse") : t("tablet.status.available")}</span>
            {currentBooking ? (
              <div className="status-panel__details">
                <p>{t("tablet.current.now", { title: currentBooking.title })}</p>
                <p>{t("tablet.current.host", { name: currentBooking.contactName })}</p>
                <p>
                  {t("tablet.current.time", {
                    timeZone: timeZoneLabel,
                    time: formatBookingTime(currentBooking.startTime, currentBooking.endTime, businessTimeZone),
                  })}
                </p>
                <p>{t("tablet.current.status")}</p>
              </div>
            ) : null}
          </div>

          <div className="tablet-booking-qr" role="group" aria-label={t("tablet.qr.group")}>
            <div className="tablet-booking-qr__copy">
              <h2>{t("tablet.qr.title")}</h2>
              <p>{t("tablet.qr.description")}</p>
              {selectedRoom ? (
                <p>
                  {t("tablet.qr.limits", {
                    max: selectedRoom.maxDurationMinutes,
                    min: selectedRoom.minDurationMinutes,
                  })}
                </p>
              ) : null}
            </div>
            <div className="tablet-booking-qr__code">
              {bookingQrCode && selectedRoom ? (
                <img src={bookingQrCode} alt={t("tablet.qr.imageAlt", { room: selectedRoom.name })} />
              ) : (
                <p>{t("tablet.qr.generating")}</p>
              )}
            </div>
          </div>
        </main>

        <aside className="tablet-side-panel tablet-schedule" aria-label={t("tablet.schedule.label")} aria-live="polite">
          <div className="tablet-schedule__header">
            <h2>{t("tablet.schedule.title")}</h2>
            <span className={bookingsLoading && confirmedBookings.length > 0 ? "tablet-schedule__sync" : undefined}>
              {bookingsLoading && confirmedBookings.length > 0
                ? t("tablet.schedule.syncing")
                : `${todayDateString(businessTimeZone)} · ${timeZoneLabel}`}
            </span>
          </div>
          {bookingsLoading && confirmedBookings.length === 0 ? (
            <p className="tablet-schedule__empty">{t("tablet.schedule.loading")}</p>
          ) : bookingsError && confirmedBookings.length === 0 ? (
            <p className="tablet-schedule__empty tablet-schedule__empty--error">{t("tablet.error.loadBookings")}</p>
          ) : confirmedBookings.length === 0 ? (
            <p className="tablet-schedule__empty">{t("tablet.schedule.empty")}</p>
          ) : (
            <ul className="tablet-schedule__list">
              {sortedBookings.map((booking) => {
                const timeState = getBookingTimeState(booking, currentTime);
                return (
                  <li className={`tablet-schedule__item tablet-schedule__item--${timeState}`} key={booking.id}>
                    <div className="tablet-schedule__item-header">
                      <strong>{booking.title}</strong>
                      <span className="tablet-schedule__state">{bookingTimeStateLabel(timeState, t)}</span>
                    </div>
                    <span className="tablet-schedule__time">
                      {formatBookingTime(booking.startTime, booking.endTime, businessTimeZone)}
                    </span>
                    <span>{t("tablet.schedule.itemMeta", { contactName: booking.contactName })}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}
