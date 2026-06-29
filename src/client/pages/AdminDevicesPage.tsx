import { useEffect, useState } from "react";

import type { Room } from "../../shared/types";
import { AdminDrawer } from "../components/AdminDrawer";
import { AdminNav } from "../components/AdminNav";
import { adminApi, type Device, type DevicePayload } from "../api";
import { useAdminI18n } from "../i18n/adminI18n";

function deviceToPayload(device?: Device): DevicePayload {
  return {
    deviceCode: device?.deviceCode ?? "",
    name: device?.name ?? "",
    defaultRoomId: device?.defaultRoomId ?? null,
    isEnabled: device?.isEnabled ?? true,
  };
}

export function AdminDevicesPage() {
  const { t } = useAdminI18n();
  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DevicePayload>(() => deviceToPayload());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const [deviceData, roomData] = await Promise.all([adminApi.listDevices(), adminApi.listRooms()]);
    setDevices(deviceData.devices);
    setRooms(roomData.rooms);
  }

  useEffect(() => {
    load().catch(() => setMessage(t("devices.loadError")));
  }, []);

  function create() {
    setEditingId(null);
    setForm(deviceToPayload());
    setIsDrawerOpen(true);
    setMessage("");
  }

  function edit(device: Device) {
    setEditingId(device.id);
    setForm(deviceToPayload(device));
    setIsDrawerOpen(true);
    setMessage("");
  }

  function resetForm() {
    setEditingId(null);
    setForm(deviceToPayload());
    setIsDrawerOpen(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      if (editingId) {
        await adminApi.updateDevice(editingId, form);
        setMessage(t("devices.updated"));
      } else {
        await adminApi.createDevice(form);
        setMessage(t("devices.created"));
      }
      resetForm();
      await load();
    } catch {
      setMessage(t("devices.saveError"));
    }
  }

  async function deleteDevice(device: Device) {
    if (!window.confirm(t("devices.deleteConfirm"))) {
      return;
    }
    setMessage("");
    try {
      await adminApi.deleteDevice(device.id);
      setMessage(t("devices.deleted"));
      await load();
    } catch {
      setMessage(t("devices.deleteError"));
    }
  }

  return (
    <section className="admin-layout">
      <AdminNav />

      <main className="admin-main">
        <header className="page-header">
          <div>
            <h1>{t("devices.title")}</h1>
            <p>{t("devices.subtitle")}</p>
          </div>
          <button className="button button--primary" type="button" onClick={create}>
            {t("devices.new")}
          </button>
        </header>

        {message ? <p className="form-message">{message}</p> : null}

        <div className="admin-list" aria-label="Devices list">
          {devices.map((device) => (
            <article className="list-row list-row--stacked" key={device.id}>
              <div className="list-row__content">
                <strong>
                  {device.name} · {device.deviceCode}
                </strong>
                <p>
                  {t("devices.defaultRoom", {
                    room: rooms.find((room) => room.id === device.defaultRoomId)?.name ?? t("devices.unbound"),
                  })}
                </p>
                <code>{`${window.location.origin}/pad/${device.deviceCode}`}</code>
              </div>
              <span className={`status-badge ${device.isEnabled ? "status-badge--success" : "status-badge--muted"}`}>
                {device.isEnabled ? t("rooms.enabled") : t("rooms.disabled")}
              </span>
              <div className="row-actions">
                <button className="button button--secondary" type="button" onClick={() => edit(device)}>
                  {t("rooms.edit")}
                </button>
                <button className="button button--danger" type="button" onClick={() => deleteDevice(device)}>
                  {t("devices.delete")}
                </button>
              </div>
            </article>
          ))}
        </div>

        <AdminDrawer
          title={editingId ? t("devices.editTitle") : t("devices.createTitle")}
          description={t("devices.drawerDescription")}
          isOpen={isDrawerOpen}
          onClose={resetForm}
        >
          <form className="booking-form admin-form-grid" onSubmit={submit}>
            <div className="form-row">
              <label htmlFor="device-code">{t("devices.code")}</label>
              <input
                id="device-code"
                value={form.deviceCode}
                onChange={(event) => setForm({ ...form, deviceCode: event.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="device-name">{t("devices.name")}</label>
              <input
                id="device-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="device-room">{t("devices.defaultRoomLabel")}</label>
              <select
                id="device-room"
                value={form.defaultRoomId ?? ""}
                onChange={(event) => setForm({ ...form, defaultRoomId: event.target.value || null })}
              >
                <option value="">{t("devices.noBinding")}</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={form.isEnabled}
                onChange={(event) => setForm({ ...form, isEnabled: event.target.checked })}
              />
              {t("devices.enable")}
            </label>
            <div className="form-actions">
              <button className="button button--primary" type="submit">
                {editingId ? t("devices.save") : t("devices.create")}
              </button>
            </div>
          </form>
        </AdminDrawer>
      </main>
    </section>
  );
}
