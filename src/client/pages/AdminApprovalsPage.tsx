import { useEffect, useState } from "react";

import { AdminNav } from "../components/AdminNav";
import { adminApi, type AdminBooking } from "../api";
import { useAdminI18n } from "../i18n/adminI18n";
import { formatBusinessDateTime } from "../../shared/time";

type LoadState = "loading" | "loaded" | "error";

function formatDateTime(value: string): string {
  return formatBusinessDateTime(value);
}

export function AdminApprovalsPage() {
  const { t } = useAdminI18n();
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");

  async function load() {
    setLoadState("loading");
    const data = await adminApi.listApprovals();
    setBookings(data.bookings);
    setLoadState("loaded");
  }

  useEffect(() => {
    load().catch(() => {
      setBookings([]);
      setLoadState("error");
    });
  }, []);

  async function review(id: string, action: "approve" | "reject") {
    setMessage("");
    try {
      if (action === "approve") {
        await adminApi.approveBooking(id);
        setMessage(t("approvals.approved"));
      } else {
        await adminApi.rejectBooking(id);
        setMessage(t("approvals.rejected"));
      }
      await load();
    } catch {
      setMessage(action === "approve" ? t("approvals.approveError") : t("approvals.rejectError"));
    }
  }

  return (
    <section className="admin-layout">
      <AdminNav />

      <main className="admin-main">
        <header className="page-header">
          <h1>{t("approvals.title")}</h1>
          <p>{t("approvals.subtitle")}</p>
        </header>

        {message ? <p className="form-message">{message}</p> : null}
        {loadState === "loading" ? <p className="form-message">{t("approvals.loading")}</p> : null}
        {loadState === "error" ? (
          <p className="form-message form-message--error" role="alert">
            {t("approvals.loadError")}
          </p>
        ) : null}
        {loadState === "loaded" && bookings.length === 0 ? (
          <p className="page-footnote">{t("approvals.empty")}</p>
        ) : null}

        {bookings.length > 0 ? (
          <div className="admin-list" aria-label="Approvals list">
            {bookings.map((booking) => (
              <article className="list-row list-row--stacked" key={booking.id}>
                <div>
                  <strong>{booking.title}</strong>
                  <p>
                    {booking.roomName ?? booking.roomId} · {formatDateTime(booking.startTime)} -{" "}
                    {formatDateTime(booking.endTime)} · {t("bookings.timeZoneLabel")}
                  </p>
                  <p>
                    {booking.contactName}
                    {booking.email ? ` · ${booking.email}` : ""}
                  </p>
                </div>
                <div className="row-actions">
                  <button className="button button--primary" type="button" onClick={() => review(booking.id, "approve")}>
                    {t("approvals.approve")}
                  </button>
                  <button className="button button--danger" type="button" onClick={() => review(booking.id, "reject")}>
                    {t("approvals.reject")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </main>
    </section>
  );
}
