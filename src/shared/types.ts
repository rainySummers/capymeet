export type BookingStatus = "pending_approval" | "confirmed" | "cancelled" | "rejected" | "completed";
export type BookingSource = "public" | "tablet" | "admin";
export type BookingLinkType = "global" | "room_specific";

export interface Room {
  id: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  roomId: string;
  title: string;
  contactName: string;
  email: string | null;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  source: BookingSource;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
  reviewedByAdminId: string | null;
  reviewedAt: string | null;
}
