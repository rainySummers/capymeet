import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminDevicesPage } from "./AdminDevicesPage";
import { AdminRoomsPage } from "./AdminRoomsPage";

function mockAdminFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) => {
      if (path === "/api/admin/devices") {
        return new Response(JSON.stringify({ devices: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ rooms: [] }), { status: 200 });
    }),
  );
}

describe("admin settings navigation", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
    cleanup();
  });

  it("shows the full admin navigation on the rooms page", () => {
    window.localStorage.setItem("adminToken", "admin-token");
    mockAdminFetch();

    render(<AdminRoomsPage />);

    expect(screen.getByRole("link", { name: "Bookings" })).toHaveAttribute("href", "/admin/bookings");
    expect(screen.getByRole("link", { name: "Approvals" })).toHaveAttribute("href", "/admin/approvals");
    expect(screen.getByRole("link", { name: "Email" })).toHaveAttribute("href", "/admin/email-settings");
    expect(screen.getByRole("link", { name: "Admins" })).toHaveAttribute("href", "/admin/admins");
  });

  it("shows the full admin navigation on the devices page", () => {
    window.localStorage.setItem("adminToken", "admin-token");
    mockAdminFetch();

    render(<AdminDevicesPage />);

    expect(screen.getByRole("link", { name: "Bookings" })).toHaveAttribute("href", "/admin/bookings");
    expect(screen.getByRole("link", { name: "Approvals" })).toHaveAttribute("href", "/admin/approvals");
    expect(screen.getByRole("link", { name: "Email" })).toHaveAttribute("href", "/admin/email-settings");
    expect(screen.getByRole("link", { name: "Admins" })).toHaveAttribute("href", "/admin/admins");
  });
});
