import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import type { Env } from "../bindings";
import { createAdmin, listAdmins, updateAdmin } from "../repositories/adminsRepository";
import {
  createBookingLink,
  deleteBookingLink,
  listBookingLinks,
  updateBookingLinkEnabled,
} from "../repositories/bookingLinksRepository";
import {
  approvePendingBooking,
  cancelActiveBookingById,
  deleteBookingById,
  getAdminBookingById,
  getBookingById,
  listAdminBookings,
  rejectPendingBooking,
} from "../repositories/bookingsRepository";
import { createDevice, deleteDevice, listDevices, updateDevice } from "../repositories/devicesRepository";
import { getBusinessSettings, saveBusinessSettings } from "../repositories/businessSettingsRepository";
import { getEmailSettings, saveEmailSettings } from "../repositories/emailSettingsRepository";
import { writeAuditLog } from "../repositories/auditLogsRepository";
import { listAllRooms } from "../repositories/roomsRepository";
import { createRoom, deleteRoom, updateRoom } from "../repositories/roomsRepository";
import { JwtSecretError, createAdminToken, verifyAdminToken, verifyPassword } from "../services/authService";
import { nowIso } from "../db";
import { createBookingSchema } from "../../shared/validation";
import { isValidTimeZone } from "../../shared/time";
import { buildApprovedBookingEmailText, buildBookingEmailText, isEmailProviderConfigured, sendOptionalEmail } from "../services/emailService";
import { createBooking } from "../services/bookingService";
import { createQrCodeDataUrl } from "../services/qrCodeService";

export const adminRoutes = new Hono<{ Bindings: Env; Variables: { adminId: string } }>();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const createLinkSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("global"),
    roomId: z.string().optional(),
  }),
  z.object({
    type: z.literal("room_specific"),
    roomId: z.string().min(1),
  }),
]);

const roomSchema = z.object({
  name: z.string().min(1).max(120),
  location: z.string().max(120).optional().default(""),
  capacity: z.number().int().positive().nullable().optional().default(null),
  equipmentNotes: z.string().max(500).nullable().optional().default(null),
  isEnabled: z.boolean().optional().default(true),
  openingHours: z.string().optional().default('{"startDate":"","endDate":"","start":"09:00","end":"17:00"}'),
  bufferMinutes: z.number().int().min(0).optional().default(5),
  minDurationMinutes: z.number().int().positive().optional().default(30),
  maxDurationMinutes: z.number().int().positive().optional().default(240),
  maxAdvanceDays: z.number().int().positive().optional().default(30),
  requiresApproval: z.boolean().optional().default(false),
});

const deviceSchema = z.object({
  deviceCode: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  defaultRoomId: z.string().min(1).nullable().optional().default(null),
  isEnabled: z.boolean().optional().default(true),
});

const bookingStatusSchema = z.enum(["pending_approval", "confirmed", "cancelled", "rejected", "completed"]);

const bookingListQuerySchema = z.object({
  status: bookingStatusSchema.optional(),
  roomId: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

const adminCreateBookingSchema = createBookingSchema.extend({
  email: z.string().email().optional().nullable().default(null),
});

const adminSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  password: z.string().min(8),
  isEnabled: z.boolean().optional().default(true),
});

const updateAdminSchema = z.object({
  name: z.string().min(1).max(120),
  password: z.string().min(8).optional(),
  isEnabled: z.boolean(),
});

const updateLinkSchema = z.object({
  isEnabled: z.boolean(),
});

const emailSettingsSchema = z.object({
  isEmailEnabled: z.boolean(),
  emailSubject: z.string().min(1).max(160),
  replyInstructions: z.string().min(1).max(1000),
});

const businessSettingsSchema = z.object({
  businessTimeZone: z.string().refine(isValidTimeZone),
});

const testEmailSchema = z.object({
  to: z.string().email(),
});

function publicBaseUrl(c: { env: Env; req: { url: string } }): string {
  return c.env.PUBLIC_BASE_URL || new URL(c.req.url).origin;
}

async function linkResponse(link: Awaited<ReturnType<typeof listBookingLinks>>[number], baseUrl: string) {
  const url = `${baseUrl}/book/${link.token}`;
  return {
    ...link,
    url,
    qrCodeDataUrl: await createQrCodeDataUrl(url),
  };
}

async function audit(
  db: D1Database,
  adminId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  metadata: Record<string, unknown> = {},
) {
  await writeAuditLog(db, {
    id: crypto.randomUUID(),
    actorType: "admin",
    actorId: adminId,
    action,
    targetType,
    targetId,
    metadata,
    createdAt: nowIso(),
  });
}

adminRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  const body = c.req.valid("json");
  const admin = await c.env.DB.prepare("SELECT id, password_hash, is_enabled FROM admins WHERE email = ?")
    .bind(body.email)
    .first<{ id: string; password_hash: string; is_enabled: number }>();

  if (!admin || admin.is_enabled !== 1) {
    return c.json({ error: "invalid_credentials" }, 401);
  }

  const valid = await verifyPassword(body.password, admin.password_hash);
  if (!valid) {
    return c.json({ error: "invalid_credentials" }, 401);
  }

  try {
    const token = await createAdminToken(admin.id, c.env.JWT_SECRET);
    return c.json({ token });
  } catch (error) {
    if (error instanceof JwtSecretError) {
      return c.json({ error: "server_misconfigured" }, 500);
    }
    throw error;
  }
});

adminRoutes.use("*", async (c, next) => {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) {
    return c.json({ error: "unauthorized" }, 401);
  }

  let adminId: string | null;
  try {
    adminId = await verifyAdminToken(token, c.env.JWT_SECRET);
  } catch (error) {
    if (error instanceof JwtSecretError) {
      return c.json({ error: "server_misconfigured" }, 500);
    }
    throw error;
  }

  if (!adminId) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const admin = await c.env.DB.prepare("SELECT id FROM admins WHERE id = ? AND is_enabled = 1")
    .bind(adminId)
    .first<{ id: string }>();
  if (!admin) {
    return c.json({ error: "unauthorized" }, 401);
  }

  c.set("adminId", adminId);
  await next();
});

adminRoutes.get("/rooms", async (c) => {
  return c.json({ rooms: await listAllRooms(c.env.DB) });
});

adminRoutes.post("/rooms", zValidator("json", roomSchema), async (c) => {
  const body = c.req.valid("json");
  const room = await createRoom(c.env.DB, {
    id: crypto.randomUUID(),
    ...body,
  });
  return c.json({ room }, 201);
});

adminRoutes.put("/rooms/:id", zValidator("json", roomSchema), async (c) => {
  const body = c.req.valid("json");
  const room = await updateRoom(c.env.DB, {
    id: c.req.param("id"),
    ...body,
  });
  if (!room) {
    return c.json({ error: "room_not_found" }, 404);
  }
  return c.json({ room });
});

adminRoutes.delete("/rooms/:id", async (c) => {
  const roomId = c.req.param("id");
  const result = await deleteRoom(c.env.DB, roomId);
  if (result === "not_found") {
    return c.json({ error: "room_not_found" }, 404);
  }
  if (result === "has_dependencies") {
    return c.json({ error: "room_has_dependencies" }, 409);
  }

  await audit(c.env.DB, c.get("adminId"), "delete_room", "room", roomId);
  return c.json({ ok: true });
});

adminRoutes.get("/devices", async (c) => {
  return c.json({ devices: await listDevices(c.env.DB) });
});

adminRoutes.get("/business-settings", async (c) => {
  return c.json({ settings: await getBusinessSettings(c.env.DB) });
});

adminRoutes.put("/business-settings", zValidator("json", businessSettingsSchema), async (c) => {
  const settings = await saveBusinessSettings(c.env.DB, {
    ...c.req.valid("json"),
    adminId: c.get("adminId"),
  });
  await audit(c.env.DB, c.get("adminId"), "update_business_settings", "business_settings", "default", {
    businessTimeZone: settings.businessTimeZone,
  });
  return c.json({ settings });
});

adminRoutes.post("/devices", zValidator("json", deviceSchema), async (c) => {
  const body = c.req.valid("json");
  const device = await createDevice(c.env.DB, {
    id: crypto.randomUUID(),
    ...body,
  });
  return c.json({ device }, 201);
});

adminRoutes.put("/devices/:id", zValidator("json", deviceSchema), async (c) => {
  const body = c.req.valid("json");
  const device = await updateDevice(c.env.DB, {
    id: c.req.param("id"),
    ...body,
  });
  if (!device) {
    return c.json({ error: "device_not_found" }, 404);
  }
  return c.json({ device });
});

adminRoutes.delete("/devices/:id", async (c) => {
  const deviceId = c.req.param("id");
  const deleted = await deleteDevice(c.env.DB, deviceId);
  if (!deleted) {
    return c.json({ error: "device_not_found" }, 404);
  }

  await audit(c.env.DB, c.get("adminId"), "delete_device", "device", deviceId);
  return c.json({ ok: true });
});

adminRoutes.get("/email-settings", async (c) => {
  const settings = await getEmailSettings(c.env.DB);
  return c.json({
    settings: {
      ...settings,
      providerConfigured: isEmailProviderConfigured(c.env),
    },
  });
});

adminRoutes.put("/email-settings", zValidator("json", emailSettingsSchema), async (c) => {
  const body = c.req.valid("json");
  const settings = await saveEmailSettings(c.env.DB, {
    ...body,
    adminId: c.get("adminId"),
    fallbackSenderEmail: c.env.EMAIL_FROM,
  });
  await audit(c.env.DB, c.get("adminId"), "update_email_settings", "email_settings", "default", {
    emailSubject: settings.emailSubject,
  });
  return c.json({
    settings: {
      ...settings,
      providerConfigured: isEmailProviderConfigured(c.env),
    },
  });
});

adminRoutes.post("/email-settings/test", zValidator("json", testEmailSchema), async (c) => {
  const { to } = c.req.valid("json");
  const [settings, businessSettings] = await Promise.all([
    getEmailSettings(c.env.DB),
    getBusinessSettings(c.env.DB),
  ]);
  const result = await sendOptionalEmail(
    {
      event: "booking_confirmed",
      to,
      subject: settings.emailSubject,
      text: buildBookingEmailText({
        statusLine: "This is a test email from the meeting booking system.",
        title: "Test meeting",
        roomName: "Test room",
        roomId: "test-room",
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        replyInstructions: settings.replyInstructions,
        businessTimeZone: businessSettings.businessTimeZone,
      }),
    },
    c.env,
  );

  if (!result.sent) {
    console.error("test_email_send_failed", result);
    return c.json({ ok: false, reason: result.reason ?? "email_failed", details: result.details ?? "" }, 502);
  }

  return c.json({ ok: true });
});

adminRoutes.get("/links", async (c) => {
  const links = await Promise.all((await listBookingLinks(c.env.DB)).map((link) => linkResponse(link, publicBaseUrl(c))));
  return c.json({ links });
});

adminRoutes.post("/links", zValidator("json", createLinkSchema), async (c) => {
  const body = c.req.valid("json");
  const link = await createBookingLink(c.env.DB, {
    type: body.type,
    roomId: body.type === "room_specific" ? body.roomId : null,
    adminId: c.get("adminId"),
  });
  await audit(c.env.DB, c.get("adminId"), "create_booking_link", "booking_link", link.id, { type: body.type });

  const [created] = (await listBookingLinks(c.env.DB)).filter((candidate) => candidate.id === link.id);
  const baseUrl = publicBaseUrl(c);
  const url = `${baseUrl}/book/${link.token}`;
  return c.json(
    created ? await linkResponse(created, baseUrl) : { ...link, url, qrCodeDataUrl: await createQrCodeDataUrl(url) },
    201,
  );
});

adminRoutes.patch("/links/:id", zValidator("json", updateLinkSchema), async (c) => {
  const body = c.req.valid("json");
  const link = await updateBookingLinkEnabled(c.env.DB, c.req.param("id"), body.isEnabled);
  if (!link) {
    return c.json({ error: "link_not_found" }, 404);
  }
  await audit(c.env.DB, c.get("adminId"), "update_booking_link", "booking_link", link.id, {
    isEnabled: body.isEnabled,
  });
  return c.json({ link: await linkResponse(link, publicBaseUrl(c)) });
});

adminRoutes.delete("/links/:id", async (c) => {
  const linkId = c.req.param("id");
  const deleted = await deleteBookingLink(c.env.DB, linkId);
  if (!deleted) {
    return c.json({ error: "link_not_found" }, 404);
  }
  await audit(c.env.DB, c.get("adminId"), "delete_booking_link", "booking_link", linkId);
  return c.json({ ok: true });
});

adminRoutes.get("/bookings", zValidator("query", bookingListQuerySchema), async (c) => {
  const query = c.req.valid("query");
  return c.json({ bookings: await listAdminBookings(c.env.DB, query), rooms: await listAllRooms(c.env.DB) });
});

adminRoutes.post("/bookings", zValidator("json", adminCreateBookingSchema), async (c) => {
  const body = c.req.valid("json");
  const { businessTimeZone } = await getBusinessSettings(c.env.DB);
  const result = await createBooking(c.env.DB, {
    ...body,
    email: body.email ?? null,
    source: "admin",
    forceConfirmed: true,
    businessTimeZone,
  });

  if (!result.ok) {
    return c.json({ error: result.error }, result.error === "booking_conflict" ? 409 : 400);
  }

  await audit(c.env.DB, c.get("adminId"), "create_booking", "booking", result.bookingId ?? null);
  return c.json({ bookingId: result.bookingId, status: result.status }, 201);
});

adminRoutes.post("/bookings/:id/cancel", async (c) => {
  const bookingId = c.req.param("id");
  const cancelled = await cancelActiveBookingById(c.env.DB, bookingId, `admin:${c.get("adminId")}`, nowIso());
  if (!cancelled) {
    return c.json({ error: "booking_not_cancellable" }, 404);
  }

  await audit(c.env.DB, c.get("adminId"), "cancel_booking", "booking", bookingId);
  return c.json({ ok: true });
});

adminRoutes.delete("/bookings/:id", async (c) => {
  const bookingId = c.req.param("id");
  const deleted = await deleteBookingById(c.env.DB, bookingId);
  if (!deleted) {
    return c.json({ error: "booking_not_found" }, 404);
  }

  await audit(c.env.DB, c.get("adminId"), "delete_booking", "booking", bookingId);
  return c.json({ ok: true });
});

adminRoutes.get("/approvals", async (c) => {
  return c.json({ bookings: await listAdminBookings(c.env.DB, { status: "pending_approval" }) });
});

adminRoutes.post("/approvals/:id/approve", async (c) => {
  const bookingId = c.req.param("id");
  const result = await approvePendingBooking(c.env.DB, bookingId, c.get("adminId"), nowIso());
  if (result === "not_found") {
    return c.json({ error: "booking_not_found" }, 404);
  }
  if (result === "conflict") {
    return c.json({ error: "booking_conflict" }, 409);
  }

  const booking = await getAdminBookingById(c.env.DB, bookingId);
  if (booking?.email) {
    const [settings, businessSettings] = await Promise.all([
      getEmailSettings(c.env.DB),
      getBusinessSettings(c.env.DB),
    ]);
    if (!settings.isEmailEnabled) {
      await audit(c.env.DB, c.get("adminId"), "approve_booking", "booking", bookingId);
      return c.json({ ok: true });
    }
    await sendOptionalEmail(
      {
        event: "booking_approved",
        to: booking.email,
        subject: settings.emailSubject,
        text: buildApprovedBookingEmailText({
          title: booking.title,
          roomName: booking.roomName,
          roomId: booking.roomId,
          startTime: booking.startTime,
          endTime: booking.endTime,
          replyInstructions: settings.replyInstructions,
          businessTimeZone: businessSettings.businessTimeZone,
        }),
      },
      c.env,
    ).catch((error) => console.error("email_send_failed", error));
  }
  await audit(c.env.DB, c.get("adminId"), "approve_booking", "booking", bookingId);
  return c.json({ ok: true });
});

adminRoutes.post("/approvals/:id/reject", async (c) => {
  const bookingId = c.req.param("id");
  const rejected = await rejectPendingBooking(c.env.DB, bookingId, c.get("adminId"), nowIso());
  if (!rejected) {
    return c.json({ error: "booking_not_found" }, 404);
  }

  const booking = await getBookingById(c.env.DB, bookingId);
  if (booking?.email) {
    await sendOptionalEmail(
      {
        event: "booking_rejected",
        to: booking.email,
        subject: "Meeting booking rejected",
        text: `Your meeting "${booking.title}" has been rejected.`,
      },
      c.env,
    ).catch((error) => console.error("email_send_failed", error));
  }
  await audit(c.env.DB, c.get("adminId"), "reject_booking", "booking", bookingId);
  return c.json({ ok: true });
});

adminRoutes.get("/admins", async (c) => {
  return c.json({ admins: await listAdmins(c.env.DB) });
});

adminRoutes.post("/admins", zValidator("json", adminSchema), async (c) => {
  const body = c.req.valid("json");
  const admin = await createAdmin(c.env.DB, { id: crypto.randomUUID(), ...body });
  await audit(c.env.DB, c.get("adminId"), "create_admin", "admin", admin.id, { email: admin.email });
  return c.json({ admin }, 201);
});

adminRoutes.put("/admins/:id", zValidator("json", updateAdminSchema), async (c) => {
  const body = c.req.valid("json");
  const admin = await updateAdmin(c.env.DB, { id: c.req.param("id"), ...body });
  if (!admin) {
    return c.json({ error: "admin_not_found" }, 404);
  }
  await audit(c.env.DB, c.get("adminId"), "update_admin", "admin", admin.id);
  return c.json({ admin });
});
