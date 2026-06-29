import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import {
  createBookingSchema,
  publicBookingsQuerySchema,
} from "../../shared/validation";
import { BUSINESS_TIME_ZONE, getUtcRangeForZonedDate } from "../../shared/time";
import type { Env } from "../bindings";
import {
  listActiveBookingsForRoomRange,
} from "../repositories/bookingsRepository";
import { getEnabledBookingLinkByToken } from "../repositories/bookingLinksRepository";
import { getEmailSettings } from "../repositories/emailSettingsRepository";
import { getRoomById, listEnabledRooms } from "../repositories/roomsRepository";
import { createBooking } from "../services/bookingService";
import { buildBookingEmailText, sendOptionalEmail } from "../services/emailService";

export const publicRoutes = new Hono<{ Bindings: Env }>();

async function sendBookingCreatedEmail(
  db: D1Database,
  env: Env,
  input: {
    email: string | null;
    title: string;
    status: "confirmed" | "pending_approval";
    roomId: string;
    startTime: string;
    endTime: string;
  },
) {
  if (input.status !== "confirmed") {
    return;
  }
  const [settings, room] = await Promise.all([getEmailSettings(db), getRoomById(db, input.roomId)]);
  if (!settings.isEmailEnabled) {
    return;
  }
  await sendOptionalEmail(
    {
      event: input.status === "confirmed" ? "booking_confirmed" : "booking_pending",
      to: input.email,
      subject: settings.emailSubject,
      text: buildBookingEmailText({
        statusLine:
          input.status === "confirmed"
            ? "Your meeting booking has been confirmed."
            : "Your meeting booking has been submitted for approval.",
        title: input.title,
        roomName: room?.name ?? null,
        roomId: input.roomId,
        startTime: input.startTime,
        endTime: input.endTime,
        replyInstructions: settings.replyInstructions,
      }),
    },
    env,
  );
}

publicRoutes.get("/rooms", async (c) => {
  return c.json({ rooms: await listEnabledRooms(c.env.DB) });
});
publicRoutes.get("/bookings", zValidator("query", publicBookingsQuerySchema), async (c) => {
  const { roomId, date } = c.req.valid("query");
  const room = await getRoomById(c.env.DB, roomId);
  if (!room?.isEnabled) {
    return c.json({ error: "room_not_found" }, 404);
  }

  const { startTime, endTime } = getUtcRangeForZonedDate(date, BUSINESS_TIME_ZONE);
  const bookings = await listActiveBookingsForRoomRange(c.env.DB, roomId, startTime, endTime);
  return c.json({
    bookings: bookings.map((booking) => ({
      id: booking.id,
      roomId: booking.roomId,
      title: booking.title,
      contactName: booking.contactName,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: booking.status,
    })),
  });
});

publicRoutes.get("/links/:token", async (c) => {
  const link = await getEnabledBookingLinkByToken(c.env.DB, c.req.param("token"));
  if (!link) {
    return c.json({ error: "booking_link_not_found" }, 404);
  }

  const rooms = await listEnabledRooms(c.env.DB);
  return c.json({
    link,
    rooms: link.roomId ? rooms.filter((room) => room.id === link.roomId) : rooms,
  });
});

publicRoutes.post("/bookings", zValidator("json", createBookingSchema), async (c) => {
  const body = c.req.valid("json");
  const result = await createBooking(c.env.DB, {
    ...body,
    source: "public",
  });

  if (!result.ok) {
    return c.json({ error: result.error }, result.error === "booking_conflict" ? 409 : 400);
  }

  try {
    await sendBookingCreatedEmail(c.env.DB, c.env, {
      email: body.email ?? null,
      title: body.title,
      status: result.status,
      roomId: body.roomId,
      startTime: body.startTime,
      endTime: body.endTime,
    });
  } catch (error) {
    console.error("email_send_failed", error);
  }

  return c.json({ bookingId: result.bookingId, status: result.status }, 201);
});

publicRoutes.post("/links/:token/bookings", zValidator("json", createBookingSchema), async (c) => {
  const link = await getEnabledBookingLinkByToken(c.env.DB, c.req.param("token"));
  if (!link) {
    return c.json({ error: "booking_link_not_found" }, 404);
  }

  const body = c.req.valid("json");
  if (link.roomId && body.roomId !== link.roomId) {
    return c.json({ error: "booking_link_room_mismatch" }, 400);
  }

  const result = await createBooking(c.env.DB, {
    ...body,
    source: "public",
  });

  if (!result.ok) {
    return c.json({ error: result.error }, result.error === "booking_conflict" ? 409 : 400);
  }

  try {
    await sendBookingCreatedEmail(c.env.DB, c.env, {
      email: body.email ?? null,
      title: body.title,
      status: result.status,
      roomId: body.roomId,
      startTime: body.startTime,
      endTime: body.endTime,
    });
  } catch (error) {
    console.error("email_send_failed", error);
  }

  return c.json({ bookingId: result.bookingId, status: result.status }, 201);
});
