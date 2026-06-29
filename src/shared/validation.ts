import { z } from "zod";
import { isValidTimeZone } from "./time";

function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const [, year, month, day] = match;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime())
    && parsed.getUTCFullYear() === Number(year)
    && parsed.getUTCMonth() + 1 === Number(month)
    && parsed.getUTCDate() === Number(day);
}

export const createBookingSchema = z.object({
  roomId: z.string().min(1),
  title: z.string().min(1).max(120),
  contactName: z.string().min(1).max(80),
  email: z.string().email(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
});
export const publicBookingsQuerySchema = z.object({
  roomId: z.string().min(1),
  date: z.string().refine(isValidDateOnly),
  timeZone: z.string().refine(isValidTimeZone).optional(),
});
