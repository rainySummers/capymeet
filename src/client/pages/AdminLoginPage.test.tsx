import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminLoginPage } from "./AdminLoginPage";

describe("AdminLoginPage", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
    window.localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders admin credential fields", () => {
    render(<AdminLoginPage />);

    expect(screen.getByRole("heading", { name: "Admin Login" })).toBeInTheDocument();
    expect(screen.getByLabelText("Admin email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows a safe error message when login fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminLoginPage />);

    await userEvent.type(screen.getByLabelText("Admin email"), "admin@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials.");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "wrong-password" }),
    });
  });

  it("stores the token after successful login", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ token: "admin-token" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    window.history.pushState({}, "", "/admin");

    render(<AdminLoginPage />);

    await userEvent.type(screen.getByLabelText("Admin email"), "admin@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret-password");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("adminToken")).toBe("admin-token");
    });
  });
});
