import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { localDateTimeToIso } from "./AdminBookingsPage";
import { AdminBookingsPage } from "./AdminBookingsPage";

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
});

describe("AdminBookingsPage date handling", () => {
  it("serializes admin date-time inputs in Germany time", () => {
    const originalTimezone = process.env.TZ;
    process.env.TZ = "Asia/Shanghai";

    try {
      expect(localDateTimeToIso("2026-04-29T10:00")).toBe("2026-04-29T08:00:00.000Z");
    } finally {
      process.env.TZ = originalTimezone;
    }
  });
});

describe("AdminBookingsPage error handling", () => {
  it("sorts bookings by meeting time and toggles descending order", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          bookings: [
            {
              id: "booking-late",
              roomId: "room-1",
              title: "Afternoon review",
              contactName: "Ada",
              email: "ada@example.com",
              startTime: "2026-04-29T07:00:00.000Z",
              endTime: "2026-04-29T08:00:00.000Z",
              status: "confirmed",
              source: "admin",
              createdAt: "2026-04-28T00:00:00.000Z",
              updatedAt: "2026-04-28T00:00:00.000Z",
              cancelledAt: null,
              cancelledBy: null,
              reviewedByAdminId: null,
              reviewedAt: null,
              roomName: "Board Room",
              roomLocation: "2F",
            },
            {
              id: "booking-early",
              roomId: "room-1",
              title: "Morning planning",
              contactName: "Grace",
              email: "grace@example.com",
              startTime: "2026-04-29T02:00:00.000Z",
              endTime: "2026-04-29T03:00:00.000Z",
              status: "confirmed",
              source: "admin",
              createdAt: "2026-04-28T00:00:00.000Z",
              updatedAt: "2026-04-28T00:00:00.000Z",
              cancelledAt: null,
              cancelledBy: null,
              reviewedByAdminId: null,
              reviewedAt: null,
              roomName: "Board Room",
              roomLocation: "2F",
            },
          ],
          rooms: [{ id: "room-1", name: "Board Room" }],
        }),
      }),
    );

    render(<AdminBookingsPage />);

    expect(await screen.findByText("Morning planning")).toBeInTheDocument();
    const bookingRows = () => screen.getAllByRole("article");
    expect(within(bookingRows()[0]).getByText("Morning planning")).toBeInTheDocument();
    expect(within(bookingRows()[0]).getByText("Meeting time")).toBeInTheDocument();
    expect(within(bookingRows()[0]).getByText(/Germany time \(Europe\/Berlin\)/)).toBeInTheDocument();
    expect(within(bookingRows()[0]).getByText(/Grace/)).toBeInTheDocument();
    expect(within(bookingRows()[0]).getByText(/grace@example.com/)).toBeInTheDocument();
    expect(screen.queryByText("meeting1")).not.toBeInTheDocument();
    expect(screen.queryByText(/contact1/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Sort by meeting time"), "desc");

    expect(within(bookingRows()[0]).getByText("Afternoon review")).toBeInTheDocument();
  });

  it("highlights room names and filters bookings by room", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          bookings: [
            {
              id: "booking-board",
              roomId: "room-1",
              title: "Board planning",
              contactName: "Ada",
              email: "ada@example.com",
              startTime: "2026-04-29T02:00:00.000Z",
              endTime: "2026-04-29T03:00:00.000Z",
              status: "confirmed",
              source: "admin",
              createdAt: "2026-04-28T00:00:00.000Z",
              updatedAt: "2026-04-28T00:00:00.000Z",
              cancelledAt: null,
              cancelledBy: null,
              reviewedByAdminId: null,
              reviewedAt: null,
              roomName: "Board Room",
              roomLocation: "2F",
            },
            {
              id: "booking-focus",
              roomId: "room-2",
              title: "Focus sync",
              contactName: "Grace",
              email: "grace@example.com",
              startTime: "2026-04-29T04:00:00.000Z",
              endTime: "2026-04-29T05:00:00.000Z",
              status: "confirmed",
              source: "admin",
              createdAt: "2026-04-28T00:00:00.000Z",
              updatedAt: "2026-04-28T00:00:00.000Z",
              cancelledAt: null,
              cancelledBy: null,
              reviewedByAdminId: null,
              reviewedAt: null,
              roomName: "Focus Room",
              roomLocation: "3F",
            },
          ],
          rooms: [
            { id: "room-1", name: "Board Room" },
            { id: "room-2", name: "Focus Room" },
          ],
        }),
      }),
    );

    render(<AdminBookingsPage />);

    expect(await screen.findByText("Board planning")).toBeInTheDocument();
    const bookingRows = () => screen.getAllByRole("article");
    expect(within(bookingRows()[0]).getByText("Meeting room")).toBeInTheDocument();
    expect(within(bookingRows()[0]).getByText("Board Room")).toBeInTheDocument();
    expect(within(bookingRows()[0]).getByText(/Ada/)).toBeInTheDocument();
    expect(within(bookingRows()[0]).getByText(/ada@example.com/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filter by room"), "room-2");

    expect(screen.queryByText("Board planning")).not.toBeInTheDocument();
    expect(screen.getByText("Focus sync")).toBeInTheDocument();
    expect(screen.getByText(/Grace/)).toBeInTheDocument();
    expect(screen.getByText(/grace@example.com/)).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("selects a room before opening the booking form and locks the room field", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          bookings: [],
          rooms: [{ id: "room-1", name: "Board Room" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ bookingId: "booking-1", status: "confirmed" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ bookings: [], rooms: [{ id: "room-1", name: "Board Room" }] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminBookingsPage />);

    await waitFor(() => expect(screen.getByText("No bookings found.")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Create booking" }));

    const roomDialog = screen.getByRole("dialog", { name: "Select room" });
    await user.selectOptions(within(roomDialog).getByLabelText("Room"), "room-1");
    await user.click(within(roomDialog).getByRole("button", { name: "Continue" }));

    const bookingDialog = screen.getByRole("dialog", { name: "Create booking" });
    expect(within(bookingDialog).getByLabelText("Room")).toBeDisabled();
    expect(within(bookingDialog).getByLabelText("Room")).toHaveValue("room-1");

    await user.type(within(bookingDialog).getByLabelText("Title"), "Room-first booking");
    await user.type(within(bookingDialog).getByLabelText("Contact"), "Zhangshan");
    expect(within(bookingDialog).queryByLabelText("Phone")).not.toBeInTheDocument();
    await user.type(within(bookingDialog).getByLabelText("Start"), "2026-04-29T18:21");
    await user.type(within(bookingDialog).getByLabelText("End"), "2026-04-29T19:19");
    await user.click(within(bookingDialog).getByRole("button", { name: "Create booking" }));

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/admin/bookings", {
      method: "POST",
      body: JSON.stringify({
        roomId: "room-1",
        title: "Room-first booking",
        contactName: "Zhangshan",
        email: null,
        startTime: "2026-04-29T16:21:00.000Z",
        endTime: "2026-04-29T17:19:00.000Z",
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
    });
  });

  it("shows the booking error type returned by the API", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            bookings: [],
            rooms: [{ id: "room-1", name: "Board Room" }],
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: vi.fn().mockResolvedValue({ error: "outside_opening_hours" }),
        }),
    );

    render(<AdminBookingsPage />);

    await waitFor(() => expect(screen.getByText("No bookings found.")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Create booking" }));
    const roomDialog = screen.getByRole("dialog", { name: "Select room" });
    expect(within(roomDialog).getByRole("option", { name: "Board Room" })).toBeInTheDocument();
    await user.selectOptions(within(roomDialog).getByLabelText("Room"), "room-1");
    await user.click(within(roomDialog).getByRole("button", { name: "Continue" }));

    const bookingDialog = screen.getByRole("dialog", { name: "Create booking" });
    await user.type(within(bookingDialog).getByLabelText("Title"), "Late sync");
    await user.type(within(bookingDialog).getByLabelText("Contact"), "Zhangshan");
    await user.type(within(bookingDialog).getByLabelText("Start"), "2026-04-29T18:21");
    await user.type(within(bookingDialog).getByLabelText("End"), "2026-04-29T19:19");

    await user.click(within(bookingDialog).getByRole("button", { name: "Create booking" }));

    expect(await screen.findByText("Booking time must be within this room's opening hours.")).toBeInTheDocument();
  });

  it("deletes a booking after confirmation and styles inactive statuses distinctly", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          bookings: [
            {
              id: "booking-1",
              roomId: "room-1",
              title: "Planning",
              contactName: "Ada",
              email: "ada@example.com",
              startTime: "2026-04-29T02:00:00.000Z",
              endTime: "2026-04-29T03:00:00.000Z",
              status: "confirmed",
              source: "admin",
              createdAt: "2026-04-28T00:00:00.000Z",
              updatedAt: "2026-04-28T00:00:00.000Z",
              cancelledAt: null,
              cancelledBy: null,
              reviewedByAdminId: null,
              reviewedAt: null,
              roomName: "Board Room",
              roomLocation: "2F",
            },
            {
              id: "booking-2",
              roomId: "room-1",
              title: "Old sync",
              contactName: "Grace",
              email: "grace@example.com",
              startTime: "2026-04-28T02:00:00.000Z",
              endTime: "2026-04-28T03:00:00.000Z",
              status: "cancelled",
              source: "public",
              createdAt: "2026-04-27T00:00:00.000Z",
              updatedAt: "2026-04-28T00:00:00.000Z",
              cancelledAt: "2026-04-28T01:00:00.000Z",
              cancelledBy: "admin:admin-1",
              reviewedByAdminId: null,
              reviewedAt: null,
              roomName: "Board Room",
              roomLocation: "2F",
            },
          ],
          rooms: [{ id: "room-1", name: "Board Room" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ bookings: [], rooms: [{ id: "room-1", name: "Board Room" }] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminBookingsPage />);

    expect(await screen.findByText("Old sync")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toHaveClass("status-badge--muted");

    const planningRow = screen.getByText("Old sync").closest("article");
    expect(planningRow).not.toBeNull();
    await user.click(within(planningRow as HTMLElement).getByRole("button", { name: "Delete" }));

    expect(confirmSpy).toHaveBeenCalledWith("Delete this booking?");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/admin/bookings/booking-2", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
    });
    expect(await screen.findByText("No bookings found.")).toBeInTheDocument();
  });
});
