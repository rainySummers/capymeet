import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminLinksPage } from "./AdminLinksPage";

const styles = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

describe("AdminLinksPage", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("loads booking links and creates a global link", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          links: [
            {
              id: "link-1",
              type: "global",
              token: "abc123",
              roomId: null,
              roomName: null,
              isEnabled: true,
              url: "https://book.example.com/book/abc123",
              qrCodeDataUrl: "data:image/png;base64,abc",
              createdAt: "2026-04-28T09:00:00.000Z",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ rooms: [{ id: "room-1", name: "Board Room" }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: "link-2",
          type: "global",
          token: "def456",
          roomId: null,
          roomName: null,
          isEnabled: true,
          url: "https://book.example.com/book/def456",
          qrCodeDataUrl: "data:image/png;base64,def",
          createdAt: "2026-04-28T10:00:00.000Z",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          links: [
            {
              id: "link-2",
              type: "global",
              token: "def456",
              roomId: null,
              roomName: null,
              isEnabled: true,
              url: "https://book.example.com/book/def456",
              qrCodeDataUrl: "data:image/png;base64,def",
              createdAt: "2026-04-28T10:00:00.000Z",
            },
            {
              id: "link-1",
              type: "global",
              token: "abc123",
              roomId: null,
              roomName: null,
              isEnabled: true,
              url: "https://book.example.com/book/abc123",
              qrCodeDataUrl: "data:image/png;base64,abc",
              createdAt: "2026-04-28T09:00:00.000Z",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ rooms: [{ id: "room-1", name: "Board Room" }] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminLinksPage />);

    expect(screen.getByRole("heading", { name: "Booking Links" })).toBeInTheDocument();
    expect(screen.getByText("Loading links...")).toBeInTheDocument();
    expect(await screen.findByText("https://book.example.com/book/abc123")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "QR code for https://book.example.com/book/abc123" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Create global link" }));

    expect(await screen.findByText("https://book.example.com/book/def456")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/admin/links", {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/admin/rooms", {
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/admin/links", {
      method: "POST",
      body: JSON.stringify({ type: "global" }),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
    });
  });

  it("keeps English link creation controls from splitting awkwardly", () => {
    const buttonRule = styles.match(/\.button\s*\{([^}]*)\}/)?.[1] ?? "";
    const rowActionsRule = styles.match(/\.row-actions\s*\{([^}]*)\}/)?.[1] ?? "";

    expect(buttonRule).toContain("white-space: nowrap;");
    expect(rowActionsRule).toContain("flex-wrap: wrap;");
  });

  it("deletes a booking link after confirmation", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          links: [
            {
              id: "link-1",
              type: "global",
              token: "abc123",
              roomId: null,
              roomName: null,
              isEnabled: true,
              url: "https://book.example.com/book/abc123",
              qrCodeDataUrl: "data:image/svg+xml;charset=utf-8,abc",
              createdAt: "2026-04-28T09:00:00.000Z",
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
        json: vi.fn().mockResolvedValue({ links: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ rooms: [] }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminLinksPage />);

    expect(await screen.findByText("https://book.example.com/book/abc123")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(confirmSpy).toHaveBeenCalledWith("Delete this booking link?");
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/admin/links/link-1", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
    });
    expect(await screen.findByText("No booking links found.")).toBeInTheDocument();
  });
});
