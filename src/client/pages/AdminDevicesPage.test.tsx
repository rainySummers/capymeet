import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminDevicesPage } from "./AdminDevicesPage";

describe("AdminDevicesPage", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("deletes a device after confirmation", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          devices: [
            {
              id: "device-1",
              deviceCode: "pad-1",
              name: "Lobby Pad",
              defaultRoomId: null,
              isEnabled: true,
              lastSeenAt: null,
              createdAt: "2026-04-28T00:00:00.000Z",
              updatedAt: "2026-04-28T00:00:00.000Z",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ rooms: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ devices: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ rooms: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminDevicesPage />);

    expect(await screen.findByText(/Lobby Pad/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(confirmSpy).toHaveBeenCalledWith("Delete this device?");
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/admin/devices/device-1", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(5));
  });
});
