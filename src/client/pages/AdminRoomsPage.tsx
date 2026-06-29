import { useEffect, useState } from "react";

import type { Room } from "../../shared/types";
import { AdminDrawer } from "../components/AdminDrawer";
import { AdminNav } from "../components/AdminNav";
import { ApiError, adminApi, type RoomPayload } from "../api";
import { useAdminI18n } from "../i18n/adminI18n";

const defaultOpeningHours = '{"startDate":"","endDate":"","start":"09:00","end":"17:00"}';
const defaultOpeningHoursValue = { startDate: "", endDate: "", start: "09:00", end: "17:00" };

function parseOpeningHours(value: string): typeof defaultOpeningHoursValue {
  try {
    const parsed = JSON.parse(value) as { startDate?: unknown; endDate?: unknown; start?: unknown; end?: unknown };
    return {
      startDate: typeof parsed.startDate === "string" ? parsed.startDate : defaultOpeningHoursValue.startDate,
      endDate: typeof parsed.endDate === "string" ? parsed.endDate : defaultOpeningHoursValue.endDate,
      start: typeof parsed.start === "string" ? parsed.start : defaultOpeningHoursValue.start,
      end: typeof parsed.end === "string" ? parsed.end : defaultOpeningHoursValue.end,
    };
  } catch {
    return defaultOpeningHoursValue;
  }
}

function updateOpeningHours(value: string, changes: Partial<typeof defaultOpeningHoursValue>): string {
  return JSON.stringify({ ...parseOpeningHours(value), ...changes });
}

function roomToPayload(room?: Room): RoomPayload {
  return {
    name: room?.name ?? "",
    location: room?.location ?? "",
    capacity: room?.capacity ?? null,
    equipmentNotes: room?.equipmentNotes ?? null,
    isEnabled: room?.isEnabled ?? true,
    openingHours: room?.openingHours ?? defaultOpeningHours,
    bufferMinutes: room?.bufferMinutes ?? 5,
    minDurationMinutes: room?.minDurationMinutes ?? 30,
    maxDurationMinutes: room?.maxDurationMinutes ?? 240,
    maxAdvanceDays: room?.maxAdvanceDays ?? 30,
    requiresApproval: room?.requiresApproval ?? false,
  };
}

export function AdminRoomsPage() {
  const { t } = useAdminI18n();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RoomPayload>(() => roomToPayload());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const openingHours = parseOpeningHours(form.openingHours);

  async function load() {
    const data = await adminApi.listRooms();
    setRooms(data.rooms);
  }

  useEffect(() => {
    load().catch(() => setMessage(t("rooms.loadError")));
  }, []);

  function create() {
    setEditingId(null);
    setForm(roomToPayload());
    setIsDrawerOpen(true);
    setMessage("");
  }

  function edit(room: Room) {
    setEditingId(room.id);
    setForm(roomToPayload(room));
    setIsDrawerOpen(true);
    setMessage("");
  }

  function resetForm() {
    setEditingId(null);
    setForm(roomToPayload());
    setIsDrawerOpen(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      if (editingId) {
        await adminApi.updateRoom(editingId, form);
        setMessage(t("rooms.updated"));
      } else {
        await adminApi.createRoom(form);
        setMessage(t("rooms.created"));
      }
      resetForm();
      await load();
    } catch {
      setMessage(t("rooms.saveError"));
    }
  }

  async function deleteRoom(room: Room) {
    if (!window.confirm(t("rooms.deleteConfirm"))) {
      return;
    }
    setMessage("");
    try {
      await adminApi.deleteRoom(room.id);
      setMessage(t("rooms.deleted"));
      await load();
    } catch (error) {
      setMessage(error instanceof ApiError && error.errorCode === "room_has_dependencies" ? t("rooms.deleteBlocked") : t("rooms.deleteError"));
    }
  }

  return (
    <section className="admin-layout">
      <AdminNav />

      <main className="admin-main">
        <header className="page-header">
          <div>
            <h1>{t("rooms.title")}</h1>
            <p>{t("rooms.subtitle")}</p>
          </div>
          <button className="button button--primary" type="button" onClick={create}>
            {t("rooms.new")}
          </button>
        </header>

        {message ? <p className="form-message">{message}</p> : null}

        <div className="admin-list" aria-label="Rooms list">
          {rooms.map((room) => (
            <article className="list-row" key={room.id}>
              <div className="list-row__content">
                <strong>{room.name}</strong>
                <p>
                  {room.location || t("rooms.locationEmpty")} ·{" "}
                  {room.capacity ? t("rooms.capacityPeople", { count: room.capacity }) : t("rooms.capacityEmpty")} ·{" "}
                  {room.requiresApproval ? t("rooms.requiresApproval") : t("rooms.autoConfirm")}
                </p>
              </div>
              <span className={`status-badge ${room.isEnabled ? "status-badge--success" : "status-badge--muted"}`}>
                {room.isEnabled ? t("rooms.enabled") : t("rooms.disabled")}
              </span>
              <div className="row-actions">
                <button className="button button--secondary" type="button" onClick={() => edit(room)}>
                  {t("rooms.edit")}
                </button>
                <button className="button button--danger" type="button" onClick={() => deleteRoom(room)}>
                  {t("rooms.delete")}
                </button>
              </div>
            </article>
          ))}
        </div>

        <AdminDrawer
          title={editingId ? t("rooms.editTitle") : t("rooms.createTitle")}
          description={t("rooms.drawerDescription")}
          isOpen={isDrawerOpen}
          onClose={resetForm}
        >
          <form className="booking-form admin-form-grid" onSubmit={submit}>
            <div className="form-row">
              <label htmlFor="room-name">{t("rooms.name")}</label>
              <input
                id="room-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="room-location">{t("rooms.location")}</label>
              <input
                id="room-location"
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
              />
            </div>
            <div className="form-row">
              <label htmlFor="room-capacity">{t("rooms.capacity")}</label>
              <input
                id="room-capacity"
                type="number"
                min="1"
                value={form.capacity ?? ""}
                onChange={(event) =>
                  setForm({ ...form, capacity: event.target.value ? Number(event.target.value) : null })
                }
              />
            </div>
            <div className="form-row">
              <label htmlFor="room-equipment">{t("rooms.equipment")}</label>
              <input
                id="room-equipment"
                value={form.equipmentNotes ?? ""}
                onChange={(event) => setForm({ ...form, equipmentNotes: event.target.value || null })}
              />
            </div>
            <div className="form-row">
              <label htmlFor="room-buffer">{t("rooms.buffer")}</label>
              <input
                id="room-buffer"
                type="number"
                min="0"
                value={form.bufferMinutes}
                onChange={(event) => setForm({ ...form, bufferMinutes: Number(event.target.value) })}
              />
            </div>
            <div className="form-row">
              <label htmlFor="room-min-duration">{t("rooms.minDuration")}</label>
              <input
                id="room-min-duration"
                type="number"
                min="1"
                value={form.minDurationMinutes}
                onChange={(event) => setForm({ ...form, minDurationMinutes: Number(event.target.value) })}
              />
            </div>
            <div className="form-row">
              <label htmlFor="room-max-duration">{t("rooms.maxDuration")}</label>
              <input
                id="room-max-duration"
                type="number"
                min="1"
                value={form.maxDurationMinutes}
                onChange={(event) => setForm({ ...form, maxDurationMinutes: Number(event.target.value) })}
              />
            </div>
            <div className="form-row">
              <label htmlFor="room-advance">{t("rooms.advanceDays")}</label>
              <input
                id="room-advance"
                type="number"
                min="1"
                value={form.maxAdvanceDays}
                onChange={(event) => setForm({ ...form, maxAdvanceDays: Number(event.target.value) })}
              />
            </div>
            <div className="form-row">
              <label htmlFor="room-opening-start-date">{t("rooms.openingStart")}</label>
              <input
                id="room-opening-start-date"
                type="date"
                value={openingHours.startDate}
                onChange={(event) =>
                  setForm({
                    ...form,
                    openingHours: updateOpeningHours(form.openingHours, { startDate: event.target.value }),
                  })
                }
                required
              />
              <p className="form-hint">{t("rooms.timeZoneHint")}</p>
            </div>
            <div className="form-row">
              <label htmlFor="room-opening-end-date">{t("rooms.openingEnd")}</label>
              <input
                id="room-opening-end-date"
                type="date"
                min={openingHours.startDate || undefined}
                value={openingHours.endDate}
                onChange={(event) =>
                  setForm({
                    ...form,
                    openingHours: updateOpeningHours(form.openingHours, { endDate: event.target.value }),
                  })
                }
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="room-opening-start-time">{t("rooms.openingStartTime")}</label>
              <input
                id="room-opening-start-time"
                type="time"
                value={openingHours.start}
                onChange={(event) =>
                  setForm({
                    ...form,
                    openingHours: updateOpeningHours(form.openingHours, { start: event.target.value }),
                  })
                }
                required
              />
              <p className="form-hint">{t("rooms.timeZoneHint")}</p>
            </div>
            <div className="form-row">
              <label htmlFor="room-opening-end-time">{t("rooms.openingEndTime")}</label>
              <input
                id="room-opening-end-time"
                type="time"
                min={openingHours.start || undefined}
                value={openingHours.end}
                onChange={(event) =>
                  setForm({
                    ...form,
                    openingHours: updateOpeningHours(form.openingHours, { end: event.target.value }),
                  })
                }
                required
              />
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.requiresApproval}
                onChange={(event) => setForm({ ...form, requiresApproval: event.target.checked })}
              />
              {t("rooms.requiresApproval")}
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.isEnabled}
                onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })}
              />
              {t("rooms.enable")}
            </label>
            <div className="form-actions">
              <button className="button button--primary" type="submit">
                {editingId ? t("rooms.save") : t("rooms.create")}
              </button>
            </div>
          </form>
        </AdminDrawer>
      </main>
    </section>
  );
}
