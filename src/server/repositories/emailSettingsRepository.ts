import { nowIso } from "../db";

const DEFAULT_SENDER_EMAIL = "noreply@example.com";
export const DEFAULT_EMAIL_SUBJECT = "Meeting Booking Notification";
export const DEFAULT_REPLY_INSTRUCTIONS =
  "This is an automated email. Contact your meeting room administrator if your meeting details change.";

interface EmailSettingsRow {
  sender_email: string;
  email_subject: string | null;
  reply_instructions: string;
  is_email_enabled: number | null;
}

export interface EmailSettings {
  isEmailEnabled: boolean;
  emailSubject: string;
  replyInstructions: string;
}

function settingsOrDefault(row: EmailSettingsRow | null): EmailSettings {
  return {
    isEmailEnabled: row?.is_email_enabled !== 0,
    emailSubject: row?.email_subject ?? DEFAULT_EMAIL_SUBJECT,
    replyInstructions: row?.reply_instructions ?? DEFAULT_REPLY_INSTRUCTIONS,
  };
}

function senderEmailForLegacyColumn(value?: string): string {
  if (!value) {
    return DEFAULT_SENDER_EMAIL;
  }
  const angleMatch = value.match(/<([^>]+)>/);
  const email = (angleMatch?.[1] ?? value).trim();
  return email.includes("@") ? email : DEFAULT_SENDER_EMAIL;
}

export async function getEmailSettings(db: D1Database): Promise<EmailSettings> {
  const row = await db
    .prepare("SELECT sender_email, email_subject, reply_instructions, is_email_enabled FROM email_settings WHERE id = 'default'")
    .first<EmailSettingsRow>();
  return settingsOrDefault(row);
}

export async function saveEmailSettings(
  db: D1Database,
  input: EmailSettings & { adminId: string; fallbackSenderEmail?: string },
): Promise<EmailSettings> {
  const updatedAt = nowIso();
  await db
    .prepare(
      `INSERT INTO email_settings (id, sender_email, email_subject, reply_instructions, is_email_enabled, updated_at, updated_by_admin_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email_subject = excluded.email_subject,
         reply_instructions = excluded.reply_instructions,
         is_email_enabled = excluded.is_email_enabled,
         updated_at = excluded.updated_at,
         updated_by_admin_id = excluded.updated_by_admin_id`,
    )
    .bind(
      "default",
      senderEmailForLegacyColumn(input.fallbackSenderEmail),
      input.emailSubject,
      input.replyInstructions,
      input.isEmailEnabled ? 1 : 0,
      updatedAt,
      input.adminId,
    )
    .run();

  return {
    isEmailEnabled: input.isEmailEnabled,
    emailSubject: input.emailSubject,
    replyInstructions: input.replyInstructions,
  };
}
