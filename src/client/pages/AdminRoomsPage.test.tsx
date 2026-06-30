import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminRoomsPage } from "./AdminRoomsPage";

describe("AdminRoomsPage", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("sends configured opening date and time range when creating a room", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ rooms: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ settings: { businessTimeZone: "Europe/Berlin" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ room: { id: "room-1" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ rooms: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ settings: { businessTimeZone: "Europe/Berlin" } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminRoomsPage />);

    await user.click(screen.getByRole("button", { name: "New room" }));
    await user.type(screen.getByLabelText("Room name"), "Late Room");
    await user.clear(screen.getByLabelText("Opening start date"));
    await user.type(screen.getByLabelText("Opening start date"), "2026-05-01");
    await user.clear(screen.getByLabelText("Opening end date"));
    await user.type(screen.getByLabelText("Opening end date"), "2026-05-31");
    await user.clear(screen.getByLabelText("Opening start time"));
    await user.type(screen.getByLabelText("Opening start time"), "08:30");
    await user.clear(screen.getByLabelText("Opening end time"));
    await user.type(screen.getByLabelText("Opening end time"), "18:00");
    expect(screen.queryByLabelText("Saturday")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create room" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/rooms", {
      method: "POST",
      body: JSON.stringify({
        name: "Late Room",
        location: "",
        capacity: null,
        equipmentNotes: null,
        isEnabled: true,
        openingHours: '{"startDate":"2026-05-01","endDate":"2026-05-31","start":"08:30","end":"18:00"}',
        bufferMinutes: 5,
        minDurationMinutes: 30,
        maxDurationMinutes: 240,
        maxAdvanceDays: 30,
        requiresApproval: false,
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
    }));
  });

  it("deletes a room after confirmation", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          rooms: [
            {
              id: "room-1",
              name: "Board Room",
              location: "2F",
              capacity: 8,
              equipmentNotes: null,
              isEnabled: true,
              openingHours: '{"days":[1,2,3,4,5],"start":"09:00","end":"18:00"}',
              bufferMinutes: 5,
              minDurationMinutes: 30,
              maxDurationMinutes: 240,
              maxAdvanceDays: 30,
              requiresApproval: false,
              createdAt: "2026-04-28T00:00:00.000Z",
              updatedAt: "2026-04-28T00:00:00.000Z",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ settings: { businessTimeZone: "Europe/Berlin" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ rooms: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ settings: { businessTimeZone: "Europe/Berlin" } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminRoomsPage />);

    expect(await screen.findByText("Board Room")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(confirmSpy).toHaveBeenCalledWith("Delete this room?");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/rooms/room-1", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
    });
  });
});
