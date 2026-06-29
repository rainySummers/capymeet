import { useEffect, useState } from "react";

import { AdminNav } from "../components/AdminNav";
import { adminApi, type BookingLink } from "../api";
import type { Room } from "../../shared/types";
import { useAdminI18n } from "../i18n/adminI18n";

type LoadState = "loading" | "loaded" | "error";

export function AdminLinksPage() {
  const { t } = useAdminI18n();
  const [links, setLinks] = useState<BookingLink[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");

  async function load() {
    setLoadState("loading");
    try {
      const [linkData, roomData] = await Promise.all([adminApi.listLinks(), adminApi.listRooms()]);
      setLinks(linkData.links);
      setRooms(roomData.rooms);
      setSelectedRoomId((current) => current || roomData.rooms[0]?.id || "");
      setLoadState("loaded");
    } catch {
      setLinks([]);
      setLoadState("error");
    }
  }

  async function createGlobal() {
    setMessage("");
    try {
      await adminApi.createGlobalLink();
      setMessage(t("links.created"));
      await load();
    } catch {
      setMessage(t("links.createError"));
    }
  }

  async function createRoomSpecific() {
    if (!selectedRoomId) {
      setMessage(t("links.selectRoomFirst"));
      return;
    }
    setMessage("");
    try {
      await adminApi.createRoomLink(selectedRoomId);
      setMessage(t("links.roomCreated"));
      await load();
    } catch {
      setMessage(t("links.roomCreateError"));
    }
  }

  async function toggle(link: BookingLink) {
    setMessage("");
    try {
      await adminApi.updateLink(link.id, { isEnabled: !link.isEnabled });
      setMessage(link.isEnabled ? t("links.disabled") : t("links.enabled"));
      await load();
    } catch {
      setMessage(t("links.updateError"));
    }
  }

  async function deleteLink(link: BookingLink) {
    if (!window.confirm(t("links.deleteConfirm"))) {
      return;
    }
    setMessage("");
    try {
      await adminApi.deleteLink(link.id);
      setMessage(t("links.deleted"));
      await load();
    } catch {
      setMessage(t("links.deleteError"));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="admin-layout">
      <AdminNav />

      <main className="admin-main">
        <header className="page-header">
          <div>
            <h1>{t("links.title")}</h1>
            <p>{t("links.subtitle")}</p>
          </div>
          <div className="row-actions">
            <button className="button button--primary" type="button" onClick={createGlobal}>
              {t("links.createGlobal")}
            </button>
            <select value={selectedRoomId} onChange={(event) => setSelectedRoomId(event.target.value)}>
              <option value="">{t("links.selectRoom")}</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
            <button className="button button--secondary" type="button" onClick={createRoomSpecific}>
              {t("links.createRoom")}
            </button>
          </div>
        </header>

        {loadState === "loading" ? <p className="form-message">{t("links.loading")}</p> : null}
        {loadState === "error" ? (
          <p className="form-message form-message--error" role="alert">
            {t("links.loadError")}
          </p>
        ) : null}
        {message ? <p className="form-message">{message}</p> : null}

        {loadState === "loaded" && links.length === 0 ? (
          <p className="page-footnote">{t("links.empty")}</p>
        ) : null}

        {links.length > 0 ? (
          <div className="admin-list" aria-label="Booking links list">
            {links.map((link) => (
              <article className="list-row list-row--stacked" key={link.id}>
                <div>
                  <strong>{link.type === "global" ? t("links.global") : link.roomName ?? link.roomId}</strong>
                  <p>
                    <span className={`status-badge ${link.isEnabled ? "status-badge--success" : "status-badge--muted"}`}>
                      {link.isEnabled ? t("admins.enabled") : t("admins.disabled")}
                    </span>
                  </p>
                  <code>{link.url}</code>
                </div>
                <img className="qr-code" src={link.qrCodeDataUrl} alt={`QR code for ${link.url}`} />
                <div className="row-actions">
                  <button className="button button--secondary" type="button" onClick={() => toggle(link)}>
                    {link.isEnabled ? t("links.disable") : t("links.enable")}
                  </button>
                  <button className="button button--danger" type="button" onClick={() => deleteLink(link)}>
                    {t("links.delete")}
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
