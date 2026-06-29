import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminDashboardPage } from "./AdminDashboardPage";
import type { Room } from "../../shared/types";
import type { AdminBooking } from "../api";

function buildRoom(overrides: Partial<Room>): Room {
  return {
    id: "room-1",
    name: "Board Room",
    location: "Level 1",
    capacity: 12,
    equipmentNotes: null,
    isEnabled: true,
    openingHours: "{}",
    bufferMinutes: 5,
    minDurationMinutes: 30,
    maxDurationMinutes: 120,
    maxAdvanceDays: 30,
    requiresApproval: false,
    createdAt: "2026-04-28T00:00:00.000Z",
    updatedAt: "2026-04-28T00:00:00.000Z",
    ...overrides,
  };
}

function buildAdminBooking(overrides: Partial<AdminBooking>): AdminBooking {
  return {
    id: "booking-1",
    roomId: "room-1",
    roomName: "Board Room",
    roomLocation: "Level 1",
    title: "Planning",
    contactName: "Alice",
    email: null,
    startTime: "2026-04-29T02:00:00.000Z",
    endTime: "2026-04-29T03:00:00.000Z",
    status: "confirmed",
    source: "public",
    createdAt: "2026-04-28T00:00:00.000Z",
    updatedAt: "2026-04-28T00:00:00.000Z",
    cancelledAt: null,
    cancelledBy: null,
    reviewedByAdminId: null,
    reviewedAt: null,
    ...overrides,
  };
}

describe("AdminDashboardPage", () => {
  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("renders admin navigation and room booking status cards", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          rooms: [
            buildRoom({ id: "room-1", name: "Board Room", requiresApproval: true }),
            buildRoom({ id: "room-2", name: "Focus Room", requiresApproval: false }),
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ bookings: [], rooms: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminDashboardPage />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("heading", { name: "Room Status" })).toBeInTheDocument();
    expect(await screen.findByText("Board Room")).toBeInTheDocument();
    expect(screen.getAllByText("Available")).toHaveLength(2);
    expect(screen.getByText("Focus Room")).toBeInTheDocument();
    expect(screen.getAllByText("Today: 0")).toHaveLength(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/admin/rooms", {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/admin/bookings", {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
    });
  });

  it("shows expandable upcoming bookings for each room", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          rooms: [
            buildRoom({ id: "room-1", name: "Board Room" }),
            buildRoom({ id: "room-2", name: "Focus Room" }),
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          rooms: [],
          bookings: [
            buildAdminBooking({
              id: "booking-1",
              title: "Morning Planning",
              contactName: "Alice",
              startTime: hoursFromNow(1),
              endTime: hoursFromNow(2),
            }),
            buildAdminBooking({
              id: "booking-2",
              title: "Design Review",
              contactName: "Bob",
              startTime: hoursFromNow(25),
              endTime: hoursFromNow(26),
            }),
            buildAdminBooking({
              id: "booking-3",
              title: "Budget Review",
              contactName: "Cindy",
              status: "pending_approval",
              startTime: hoursFromNow(49),
              endTime: hoursFromNow(50),
            }),
            buildAdminBooking({
              id: "booking-4",
              title: "Quarterly Planning",
              contactName: "David",
              startTime: hoursFromNow(73),
              endTime: hoursFromNow(74),
            }),
            buildAdminBooking({
              id: "booking-5",
              roomId: "room-2",
              roomName: "Focus Room",
              title: "Focus Sync",
              contactName: "Erin",
              startTime: hoursFromNow(27),
              endTime: hoursFromNow(28),
            }),
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminDashboardPage />);

    expect(await screen.findAllByText("Morning Planning")).not.toHaveLength(0);
    expect(screen.getAllByText(/Alice · Confirmed/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Design Review")).toBeInTheDocument();
    expect(screen.getByText(/Bob · Confirmed/)).toBeInTheDocument();
    expect(screen.getByText("Budget Review")).toBeInTheDocument();
    expect(screen.getByText(/Cindy · Pending approval/)).toBeInTheDocument();
    expect(screen.queryByText("Quarterly Planning")).not.toBeInTheDocument();
    expect(screen.getByText("Focus Sync")).toBeInTheDocument();
    expect(screen.queryByText("meeting1")).not.toBeInTheDocument();
    expect(screen.queryByText(/contact1/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show all" }));

    expect(screen.getByText("Quarterly Planning")).toBeInTheDocument();
    expect(screen.getByText(/David · Confirmed/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));

    expect(screen.queryByText("Quarterly Planning")).not.toBeInTheDocument();
  });

  it("formats upcoming booking dates in English when the admin language is English", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-04-28T08:00:00.000Z"));
    window.localStorage.setItem("adminToken", "admin-token");
    window.localStorage.setItem("adminLanguage", "en");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          rooms: [buildRoom({ id: "room-1", name: "Board Room" })],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          rooms: [],
          bookings: [
            buildAdminBooking({
              id: "booking-1",
              startTime: "2026-04-29T08:00:00.000Z",
              endTime: "2026-04-29T09:00:00.000Z",
            }),
          ],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminDashboardPage />);

    expect(await screen.findByText(/Apr 29, 10:00 - 11:00/)).toBeInTheDocument();
    expect(screen.queryByText(/4月29日/)).not.toBeInTheDocument();
    expect(screen.getByText(/Germany time \(Europe\/Berlin\)/)).toBeInTheDocument();
  });
});
