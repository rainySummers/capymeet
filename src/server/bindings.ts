export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  EMAIL_API_KEY?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  PUBLIC_BASE_URL: string;
}
