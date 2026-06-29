import type { Booking, BookingStatus, Room } from "../shared/types";
import { BUSINESS_TIME_ZONE } from "../shared/time";

export interface PublicBookingSummary {
  id: string;
  roomId: string;
  title: string;
  startTime: string;
  endTime: string;
  status: "confirmed" | "pending_approval";
}

export interface PublicRoomBooking extends PublicBookingSummary {
  contactName: string;
}

export interface TabletResponse {
  device: {
    deviceCode: string;
    name: string;
    defaultRoomId: string | null;
    isEnabled: boolean;
  };
  defaultRoom: Room | null;
  rooms: Room[];
}

export interface Device {
  id: string;
  deviceCode: string;
  name: string;
  defaultRoomId: string | null;
  isEnabled: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoomPayload {
  name: string;
  location: string;
  capacity: number | null;
  equipmentNotes: string | null;
  isEnabled: boolean;
  openingHours: string;
  bufferMinutes: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  maxAdvanceDays: number;
  requiresApproval: boolean;
}

export interface DevicePayload {
  deviceCode: string;
  name: string;
  defaultRoomId: string | null;
  isEnabled: boolean;
}

export interface AdminBooking extends Booking {
  roomName: string | null;
  roomLocation: string | null;
}

export interface AdminBookingPayload {
  roomId: string;
  title: string;
  contactName: string;
  email: string | null;
  startTime: string;
  endTime: string;
}

export interface AdminAccount {
  id: string;
  email: string;
  name: string;
  isEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPayload {
  email: string;
  name: string;
  password: string;
  isEnabled: boolean;
}

export interface AdminUpdatePayload {
  name: string;
  password?: string;
  isEnabled: boolean;
}

export interface EmailSettings {
  isEmailEnabled: boolean;
  emailSubject: string;
  replyInstructions: string;
  providerConfigured: boolean;
}

export interface EmailSettingsPayload {
  isEmailEnabled: boolean;
  emailSubject: string;
  replyInstructions: string;
}

export interface TestEmailResult {
  ok: boolean;
  reason?: string;
  details?: string;
}

export interface BookingLink {
  id: string;
  type: "global" | "room_specific";
  token: string;
  roomId: string | null;
  roomName: string | null;
  isEnabled: boolean;
  url: string;
  qrCodeDataUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicBookingLinkResponse {
  link: Omit<BookingLink, "url" | "qrCodeDataUrl">;
  rooms: Room[];
}

export class ApiError extends Error {
  status: number;
  errorCode: string | null;

  constructor(status: number, message: string, errorCode: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = errorCode;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let errorCode: string | null = null;
    try {
      const body = (await response.json()) as { error?: unknown };
      errorCode = typeof body.error === "string" ? body.error : null;
    } catch {
      errorCode = null;
    }
    throw new ApiError(response.status, `Request failed: ${response.status}`, errorCode);
  }
  return (await response.json()) as T;
}

export const api = {
  listRooms: () => request<{ rooms: Room[] }>("/api/public/rooms"),
  getBookingLink: (token: string) => request<PublicBookingLinkResponse>(`/api/public/links/${token}`),
  createBooking: (body: {
    roomId: string;
    title: string;
    contactName: string;
    email: string;
    startTime: string;
    endTime: string;
  }) =>
    request<{ bookingId: string; status: "confirmed" | "pending_approval" }>(
      "/api/public/bookings",
      { method: "POST", body: JSON.stringify(body) },
    ),
  createBookingWithLink: (
    token: string,
    body: {
      roomId: string;
      title: string;
      contactName: string;
      email: string;
      startTime: string;
      endTime: string;
    },
  ) =>
    request<{ bookingId: string; status: "confirmed" | "pending_approval" }>(
      `/api/public/links/${token}/bookings`,
      { method: "POST", body: JSON.stringify(body) },
    ),
  listPublicBookings: (roomId: string, date: string, timeZone = BUSINESS_TIME_ZONE) => {
    const params = new URLSearchParams({ roomId, date, timeZone });
    return request<{ bookings: PublicRoomBooking[] }>(`/api/public/bookings?${params.toString()}`);
  },
  getTablet: (deviceCode: string) => request<TabletResponse>(`/api/tablet/${deviceCode}`),
  sendHeartbeat: (deviceCode: string) =>
    request<{ ok: true }>(`/api/tablet/${deviceCode}/heartbeat`, { method: "POST" }),
};

export function getAdminToken(): string | null {
  return window.localStorage.getItem("adminToken");
}

export function setAdminToken(token: string): void {
  window.localStorage.setItem("adminToken", token);
}

export function clearAdminToken(): void {
  window.localStorage.removeItem("adminToken");
}

export async function adminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAdminToken();
  try {
    return await request<T>(path, {
      ...init,
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
        ...init?.headers,
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      clearAdminToken();
      if (window.location.pathname !== "/admin/login") {
        window.location.href = "/admin/login";
      }
    }
    throw error;
  }
}

export const adminApi = {
  listRooms: () => adminRequest<{ rooms: Room[] }>("/api/admin/rooms"),
  createRoom: (body: RoomPayload) =>
    adminRequest<{ room: Room }>("/api/admin/rooms", { method: "POST", body: JSON.stringify(body) }),
  updateRoom: (id: string, body: RoomPayload) =>
    adminRequest<{ room: Room }>(`/api/admin/rooms/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteRoom: (id: string) => adminRequest<{ ok: true }>(`/api/admin/rooms/${id}`, { method: "DELETE" }),
  listDevices: () => adminRequest<{ devices: Device[] }>("/api/admin/devices"),
  createDevice: (body: DevicePayload) =>
    adminRequest<{ device: Device }>("/api/admin/devices", { method: "POST", body: JSON.stringify(body) }),
  updateDevice: (id: string, body: DevicePayload) =>
    adminRequest<{ device: Device }>(`/api/admin/devices/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteDevice: (id: string) => adminRequest<{ ok: true }>(`/api/admin/devices/${id}`, { method: "DELETE" }),
  listLinks: () => adminRequest<{ links: BookingLink[] }>("/api/admin/links"),
  createGlobalLink: () =>
    adminRequest<BookingLink>("/api/admin/links", { method: "POST", body: JSON.stringify({ type: "global" }) }),
  createRoomLink: (roomId: string) =>
    adminRequest<BookingLink>("/api/admin/links", {
      method: "POST",
      body: JSON.stringify({ type: "room_specific", roomId }),
    }),
  updateLink: (id: string, body: { isEnabled: boolean }) =>
    adminRequest<{ link: BookingLink }>(`/api/admin/links/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteLink: (id: string) => adminRequest<{ ok: true }>(`/api/admin/links/${id}`, { method: "DELETE" }),
  listBookings: (filters: { status?: BookingStatus; roomId?: string; startTime?: string; endTime?: string } = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    const query = params.toString();
    return adminRequest<{ bookings: AdminBooking[]; rooms: Room[] }>(`/api/admin/bookings${query ? `?${query}` : ""}`);
  },
  createBooking: (body: AdminBookingPayload) =>
    adminRequest<{ bookingId: string; status: BookingStatus }>("/api/admin/bookings", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  cancelBooking: (id: string) =>
    adminRequest<{ ok: true }>(`/api/admin/bookings/${id}/cancel`, { method: "POST" }),
  deleteBooking: (id: string) =>
    adminRequest<{ ok: true }>(`/api/admin/bookings/${id}`, { method: "DELETE" }),
  listApprovals: () => adminRequest<{ bookings: AdminBooking[] }>("/api/admin/approvals"),
  approveBooking: (id: string) =>
    adminRequest<{ ok: true }>(`/api/admin/approvals/${id}/approve`, { method: "POST" }),
  rejectBooking: (id: string) =>
    adminRequest<{ ok: true }>(`/api/admin/approvals/${id}/reject`, { method: "POST" }),
  getEmailSettings: () => adminRequest<{ settings: EmailSettings }>("/api/admin/email-settings"),
  updateEmailSettings: (body: EmailSettingsPayload) =>
    adminRequest<{ settings: EmailSettings }>("/api/admin/email-settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  sendTestEmail: async (to: string) => {
    const response = await fetch("/api/admin/email-settings/test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: getAdminToken() ? `Bearer ${getAdminToken()}` : "",
      },
      body: JSON.stringify({ to }),
    });
    return (await response.json()) as TestEmailResult;
  },
  listAdmins: () => adminRequest<{ admins: AdminAccount[] }>("/api/admin/admins"),
  createAdmin: (body: AdminPayload) =>
    adminRequest<{ admin: AdminAccount }>("/api/admin/admins", { method: "POST", body: JSON.stringify(body) }),
  updateAdmin: (id: string, body: AdminUpdatePayload) =>
    adminRequest<{ admin: AdminAccount }>(`/api/admin/admins/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
};
