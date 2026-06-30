import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { App } from "./App";
import { api, type AdminBooking } from "./client/api";
import type { Room } from "./shared/types";

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
    startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    status: "confirmed",
    source: "public",
    createdAt: new Date(Date.now()).toISOString(),
    updatedAt: new Date(Date.now()).toISOString(),
    cancelledAt: null,
    cancelledBy: null,
    reviewedByAdminId: null,
    reviewedAt: null,
    ...overrides,
  };
}

describe("App routing", () => {
  beforeEach(() => {
    vi.spyOn(api, "listRooms").mockResolvedValue({ rooms: [] });
    vi.spyOn(api, "getTablet").mockResolvedValue({
      device: {
        deviceCode: "pad-1",
        name: "Lobby Tablet",
        defaultRoomId: null,
        isEnabled: true,
      },
      defaultRoom: null,
      rooms: [],
    });
    vi.spyOn(api, "sendHeartbeat").mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.pushState({}, "", "/");
    window.localStorage.clear();
    cleanup();
  });

  test("renders the public booking page on /", async () => {
    window.history.pushState({}, "", "/");
    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Book a Meeting Room" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(api.listRooms).toHaveBeenCalled());
  });

  test("switches public booking pages between English and Chinese and remembers the choice", async () => {
    window.localStorage.setItem("publicLanguage", "zh");
    window.history.pushState({}, "", "/");
    render(<App />);

    expect(await screen.findByRole("heading", { name: "预订会议室" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "English" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "English" }));

    expect(screen.getByRole("heading", { name: "Book a Meeting Room" })).toBeInTheDocument();
    expect(window.localStorage.getItem("publicLanguage")).toBe("en");
  });

  test("renders the cancellation page on /cancel", () => {
    window.history.pushState({}, "", "/cancel");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Cancellation unavailable" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Phone number")).not.toBeInTheDocument();
  });

  test("renders the cancellation page in Chinese when public language is Chinese", () => {
    window.localStorage.setItem("publicLanguage", "zh");
    window.history.pushState({}, "", "/cancel");
    render(<App />);

    expect(screen.getByRole("heading", { name: "无法取消预订" })).toBeInTheDocument();
    expect(screen.getByText("自助取消功能已移除。如需修改预订，请联系管理员。")).toBeInTheDocument();
  });

  test("renders the tablet page on /pad/:deviceCode", async () => {
    window.history.pushState({}, "", "/pad/pad-1");
    render(<App />);

    expect(await screen.findByText("Meeting Room")).toBeInTheDocument();
  });

  test("renders the tablet page in Chinese when public language is Chinese", async () => {
    window.localStorage.setItem("publicLanguage", "zh");
    window.history.pushState({}, "", "/pad/pad-1");
    render(<App />);

    expect(await screen.findByText("会议室")).toBeInTheDocument();
    expect(screen.getByText("未选择会议室")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "English" })).toBeInTheDocument();
  });

  test("renders the admin login page on /admin/login", () => {
    window.history.pushState({}, "", "/admin/login");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Admin Login" })).toBeInTheDocument();
  });

  test("redirects direct admin visits to login when not authenticated", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/admin");

    render(<App />);

    expect(screen.getByRole("heading", { name: "Admin Login" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/admin/login");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("keeps authenticated admin visits on the requested page", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ rooms: [buildRoom({ name: "Board Room" })] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ rooms: [], bookings: [] }),
        }),
    );
    window.history.pushState({}, "", "/admin");

    render(<App />);

    expect(screen.getByRole("heading", { name: "Room Status" })).toBeInTheDocument();
    expect(await screen.findByText("Board Room")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/admin");
  });

  test("renders the admin dashboard on /admin", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-05-07T08:00:00.000Z"));
    window.localStorage.setItem("adminToken", "admin-token");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ rooms: [buildRoom({ name: "Board Room" })] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            rooms: [buildRoom({ name: "Board Room" })],
            bookings: [
              buildAdminBooking({ title: "Planning" }),
              buildAdminBooking({
                id: "booking-2",
                title: "Design Review",
                startTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
                endTime: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
              }),
              buildAdminBooking({
                id: "booking-3",
                title: "Budget Review",
                status: "pending_approval",
                startTime: new Date(Date.now() + 150 * 60 * 1000).toISOString(),
                endTime: new Date(Date.now() + 180 * 60 * 1000).toISOString(),
              }),
            ],
          }),
        }),
    );
    window.history.pushState({}, "", "/admin");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Room Status" })).toBeInTheDocument();
    expect(await screen.findByText("Board Room")).toBeInTheDocument();
    expect(screen.getByText("In use")).toBeInTheDocument();
    expect(screen.getByText("Now: Planning")).toBeInTheDocument();
    expect(screen.getByText("Next: Design Review")).toBeInTheDocument();
    expect(screen.getByText("Today: 3")).toBeInTheDocument();
    expect(screen.getByText("Pending: 1")).toBeInTheDocument();
  });

  test("renders the admin rooms page as list first and opens create drawer from an action", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ rooms: [buildRoom({ name: "Board Room" })] }),
      }),
    );
    window.history.pushState({}, "", "/admin/rooms");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Rooms" })).toBeInTheDocument();
    expect(await screen.findByText(/Board Room/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Room name")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "New room" }));

    expect(screen.getByRole("dialog", { name: "New room" })).toBeInTheDocument();
    expect(screen.getByLabelText("Room name")).toBeInTheDocument();
  });

  test("switches admin pages between English and Chinese and remembers the choice", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ rooms: [buildRoom({ name: "Board Room" })] }),
      }),
    );
    window.history.pushState({}, "", "/admin/rooms");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Rooms" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "中文" }));

    expect(screen.getByRole("heading", { name: "会议室管理" })).toBeInTheDocument();
    expect(window.localStorage.getItem("adminLanguage")).toBe("zh");
  });

  test("renders the admin links page on /admin/links", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ links: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ rooms: [] }),
        }),
    );
    window.history.pushState({}, "", "/admin/links");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Booking Links" })).toBeInTheDocument();
    expect(await screen.findByText("No booking links found.")).toBeInTheDocument();
  });

  test("renders the admin bookings page on /admin/bookings", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ bookings: [], rooms: [] }),
      }),
    );
    window.history.pushState({}, "", "/admin/bookings");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Bookings" })).toBeInTheDocument();
    expect(await screen.findByText("No bookings found.")).toBeInTheDocument();
  });

  test("renders the admin approvals page on /admin/approvals", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ bookings: [] }),
      }),
    );
    window.history.pushState({}, "", "/admin/approvals");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Approvals" })).toBeInTheDocument();
    expect(await screen.findByText("No pending approvals.")).toBeInTheDocument();
  });

  test("renders real pending booking details on /admin/approvals", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          bookings: [
            buildAdminBooking({
              title: "Leadership Review",
              contactName: "Alice",
              email: "alice@example.com",
              status: "pending_approval",
            }),
          ],
        }),
      }),
    );
    window.history.pushState({}, "", "/admin/approvals");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Approvals" })).toBeInTheDocument();
    expect(await screen.findByText("Leadership Review")).toBeInTheDocument();
    expect(screen.getByText(/Alice · alice@example.com/)).toBeInTheDocument();
    expect(screen.queryByText("meeting1")).not.toBeInTheDocument();
    expect(screen.queryByText(/contact1/)).not.toBeInTheDocument();
  });

  test("renders the admin accounts page on /admin/admins", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ admins: [] }),
      }),
    );
    window.history.pushState({}, "", "/admin/admins");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Admins" })).toBeInTheDocument();
    expect(await screen.findByText("No admins found.")).toBeInTheDocument();
  });
});
