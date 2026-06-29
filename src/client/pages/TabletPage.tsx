import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode/lib/browser";

import type { Room } from "../../shared/types";
import {
  BUSINESS_TIME_ZONE,
  BUSINESS_TIME_ZONE_LABEL,
  formatBusinessTimeRange,
  getZonedDateString,
} from "../../shared/time";
import { api, type PublicRoomBooking } from "../api";
import capymeetLogo from "../assets/capymeet-logo.png";

type LoadState = "loading" | "loaded" | "error";
type BookingTimeState = "current" | "upcoming" | "past";

const TABLET_REFRESH_MS = 10000;
const TABLET_IDLE_RETURN_MS = 10000;

function todayDateString(): string {
  return getZonedDateString(new Date(Date.now()));
}

function formatBookingTime(startTime: string, endTime: string): string {
  return formatBusinessTimeRange(startTime, endTime);
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

function bookingTimeStateLabel(timeState: BookingTimeState): string {
  if (timeState === "current") {
    return "Now";
  }
  return timeState === "past" ? "Ended" : "Upcoming";
}

function roomCapacityLabel(room: Room | null): string | null {
  if (!room?.capacity) {
    return null;
  }
  return `(${room.capacity} ${room.capacity === 1 ? "person" : "people"})`;
}

export function TabletPage({ deviceCode }: { deviceCode: string }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [defaultRoomId, setDefaultRoomId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [bookings, setBookings] = useState<PublicRoomBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [refreshTick, setRefreshTick] = useState(0);
  const [roomActivityTick, setRoomActivityTick] = useState(0);
  const [bookingQrCode, setBookingQrCode] = useState<string | null>(null);
  const bookingsRoomIdRef = useRef<string | null>(null);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ?? null,
    [rooms, selectedRoomId],
  );
  const selectedRoomCapacityLabel = roomCapacityLabel(selectedRoom);
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

    api
      .getTablet(deviceCode)
      .then((data) => {
        if (cancelled) {
          return;
        }
        const roomId = data.defaultRoom?.id ?? data.rooms[0]?.id ?? "";
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
      setBookingsError(null);
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
    setBookingsError(null);
    api
      .listPublicBookings(selectedRoomId, todayDateString(), BUSINESS_TIME_ZONE)
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
  }, [refreshTick, selectedRoomId]);

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
        <p className="tablet-message">Loading tablet...</p>
      </section>
    );
  }

  if (loadState === "error") {
    return (
      <section className="tablet">
        <p className="tablet-message tablet-message--error" role="alert">
          Could not load tablet.
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
        <main className="tablet-main-panel" aria-label="Room status">
          <header className="tablet-header">
            <div className="tablet-header-top">
              <div className="tablet-logo-surface">
                <img className="tablet-company-logo" src={capymeetLogo} alt="CapyMeet logo" />
              </div>
              {rooms.length > 0 ? (
                <label className="tablet-switcher">
                  <span>Switch room</span>
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
            <div className="tablet-room-heading">
              <p className="tablet-room-kicker">Meeting Room</p>
              <div className="tablet-room-title">
                <h1>{selectedRoom?.name ?? "No room selected"}</h1>
                {selectedRoomCapacityLabel ? (
                  <span className="tablet-room-capacity">{selectedRoomCapacityLabel}</span>
                ) : null}
              </div>
            </div>
          </header>

          <div className={`status-panel ${currentBooking ? "in-use" : "available"}`} aria-live="polite">
            <span>{currentBooking ? "In Use" : "Available"}</span>
            {currentBooking ? (
              <div className="status-panel__details">
                <p>Now: {currentBooking.title}</p>
                <p>Host: {currentBooking.contactName}</p>
                <p>Time ({BUSINESS_TIME_ZONE_LABEL}): {formatBookingTime(currentBooking.startTime, currentBooking.endTime)}</p>
                <p>Status: Confirmed</p>
              </div>
            ) : null}
          </div>

          <div className="tablet-booking-qr" role="group" aria-label="Room booking QR code">
            <div className="tablet-booking-qr__copy">
              <h2>Scan to book this room</h2>
              <p>Scan with your mobile device to book this room.</p>
              {selectedRoom ? (
                <p>
                  Maximum meeting duration is {selectedRoom.maxDurationMinutes} minutes. Minimum booking duration is{" "}
                  {selectedRoom.minDurationMinutes} minutes.
                </p>
              ) : null}
            </div>
            <div className="tablet-booking-qr__code">
              {bookingQrCode && selectedRoom ? (
                <img src={bookingQrCode} alt={`Booking QR code for ${selectedRoom.name}`} />
              ) : (
                <p>Generating QR code...</p>
              )}
            </div>
          </div>
        </main>

        <aside className="tablet-side-panel tablet-schedule" aria-label="Today's bookings" aria-live="polite">
          <div className="tablet-schedule__header">
            <h2>Today's bookings</h2>
            <span className={bookingsLoading && confirmedBookings.length > 0 ? "tablet-schedule__sync" : undefined}>
                  {bookingsLoading && confirmedBookings.length > 0 ? "Syncing..." : `${todayDateString()} · ${BUSINESS_TIME_ZONE_LABEL}`}
            </span>
          </div>
          {bookingsLoading && confirmedBookings.length === 0 ? (
            <p className="tablet-schedule__empty">Loading bookings...</p>
          ) : bookingsError && confirmedBookings.length === 0 ? (
            <p className="tablet-schedule__empty tablet-schedule__empty--error">{bookingsError}</p>
          ) : confirmedBookings.length === 0 ? (
            <p className="tablet-schedule__empty">No bookings today.</p>
          ) : (
            <ul className="tablet-schedule__list">
              {sortedBookings.map((booking) => {
                const timeState = getBookingTimeState(booking, currentTime);
                return (
                  <li className={`tablet-schedule__item tablet-schedule__item--${timeState}`} key={booking.id}>
                    <div className="tablet-schedule__item-header">
                      <strong>{booking.title}</strong>
                      <span className="tablet-schedule__state">{bookingTimeStateLabel(timeState)}</span>
                    </div>
                    <span className="tablet-schedule__time">{formatBookingTime(booking.startTime, booking.endTime)}</span>
                    <span>{booking.contactName} · Confirmed</span>
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
