import { BUSINESS_TIME_ZONE, isValidTimeZone } from "../shared/time";
import { adminApi, api } from "./api";

function businessTimeZoneFromResponse(data: unknown): string {
  if (!data || typeof data !== "object") {
    return BUSINESS_TIME_ZONE;
  }
  const settings = "settings" in data ? (data as { settings?: unknown }).settings : null;
  if (!settings || typeof settings !== "object") {
    return BUSINESS_TIME_ZONE;
  }
  const businessTimeZone = (settings as { businessTimeZone?: unknown }).businessTimeZone;
  return typeof businessTimeZone === "string" && isValidTimeZone(businessTimeZone)
    ? businessTimeZone
    : BUSINESS_TIME_ZONE;
}

export async function loadPublicBusinessTimeZone(): Promise<string> {
  try {
    return businessTimeZoneFromResponse(await api.getSettings());
  } catch {
    return BUSINESS_TIME_ZONE;
  }
}

export async function loadAdminBusinessTimeZone(): Promise<string> {
  try {
    return businessTimeZoneFromResponse(await adminApi.getBusinessSettings());
  } catch {
    return BUSINESS_TIME_ZONE;
  }
}
