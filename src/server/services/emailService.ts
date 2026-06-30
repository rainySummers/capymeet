import { BUSINESS_TIME_ZONE, formatEmailTimeZoneLabel, getZonedParts } from "../../shared/time";

export type EmailEvent =
  | "booking_confirmed"
  | "booking_pending"
  | "booking_cancelled"
  | "booking_approved"
  | "booking_rejected";

export interface EmailInput {
  event: EmailEvent;
  to: string | null;
  subject: string;
  text: string;
  from?: string;
}

interface ResendEnv {
  RESEND_API_KEY?: string;
  EMAIL_API_KEY?: string;
  EMAIL_FROM?: string;
}

function resendApiKey(env: ResendEnv): string | undefined {
  return env.RESEND_API_KEY ?? env.EMAIL_API_KEY;
}

export function isEmailProviderConfigured(env: ResendEnv): boolean {
  return Boolean(resendApiKey(env) && env.EMAIL_FROM);
}

export async function sendOptionalEmail(
  input: EmailInput,
  env: ResendEnv,
): Promise<{ sent: boolean; reason?: string; details?: string }> {
  if (!input.to) {
    return { sent: false, reason: "missing_recipient" };
  }
  const from = input.from ?? env.EMAIL_FROM;
  const apiKey = resendApiKey(env);
  if (!apiKey || !from) {
    return { sent: false, reason: "email_not_configured" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    }),
  });

  if (response.ok) {
    return { sent: true };
  }

  const details = await response.text().catch(() => "");
  return { sent: false, reason: `resend_${response.status}`, details };
}

export function buildBookingEmailText(input: {
  statusLine: string;
  title: string;
  roomName: string | null;
  roomId: string;
  startTime: string;
  endTime: string;
  replyInstructions?: string;
  businessTimeZone?: string;
}): string {
  const businessTimeZone = input.businessTimeZone ?? BUSINESS_TIME_ZONE;
  const timeZoneLabel = formatEmailTimeZoneLabel(businessTimeZone);
  const lines = [
    input.statusLine,
    "",
    `Meeting: ${input.title}`,
    `Room: ${input.roomName ?? input.roomId}`,
    `Time zone: ${timeZoneLabel}`,
    `Start: ${formatZonedTime(input.startTime, businessTimeZone)}`,
    `End: ${formatZonedTime(input.endTime, businessTimeZone)}`,
  ];

  if (input.replyInstructions) {
    lines.push("", input.replyInstructions);
  }

  return lines.join("\n");
}

function formatZonedTime(value: string, timeZone: string): string {
  const parts = getZonedParts(value, timeZone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)} ${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function buildApprovedBookingEmailText(input: {
  title: string;
  roomName: string | null;
  roomId: string;
  startTime: string;
  endTime: string;
  replyInstructions: string;
  businessTimeZone?: string;
}): string {
  return buildBookingEmailText({
    ...input,
    statusLine: "Your meeting booking has been approved.",
  });
}
