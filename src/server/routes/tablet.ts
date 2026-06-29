import { Hono } from "hono";

import type { Env } from "../bindings";
import { getDeviceByCode, updateDeviceHeartbeat } from "../repositories/devicesRepository";
import { getRoomById, listEnabledRooms } from "../repositories/roomsRepository";

export const tabletRoutes = new Hono<{ Bindings: Env }>();

tabletRoutes.get("/:deviceCode", async (c) => {
  const device = await getDeviceByCode(c.env.DB, c.req.param("deviceCode"));
  if (!device || !device.isEnabled) {
    return c.json({ error: "device_not_found" }, 404);
  }

  const defaultRoom = device.defaultRoomId ? await getRoomById(c.env.DB, device.defaultRoomId) : null;
  const rooms = await listEnabledRooms(c.env.DB);
  return c.json({
    device: {
      deviceCode: device.deviceCode,
      name: device.name,
      defaultRoomId: device.defaultRoomId,
      isEnabled: device.isEnabled,
    },
    defaultRoom,
    rooms,
  });
});

tabletRoutes.post("/:deviceCode/heartbeat", async (c) => {
  const deviceCode = c.req.param("deviceCode");
  const device = await getDeviceByCode(c.env.DB, deviceCode);
  if (!device || !device.isEnabled) {
    return c.json({ error: "device_not_found" }, 404);
  }

  const updated = await updateDeviceHeartbeat(c.env.DB, deviceCode);
  if (!updated) {
    return c.json({ error: "device_not_found" }, 404);
  }
  return c.json({ ok: true });
});
