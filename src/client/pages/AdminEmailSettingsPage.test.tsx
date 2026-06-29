import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminEmailSettingsPage } from "./AdminEmailSettingsPage";

describe("AdminEmailSettingsPage", () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("loads email settings and saves availability switch, title, and body", async () => {
    window.localStorage.setItem("adminToken", "admin-token");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          settings: {
            isEmailEnabled: true,
            emailSubject: "Meeting Booking Notification",
            replyInstructions:
              "This is an automated email. Contact your meeting room administrator if your meeting details change.",
            providerConfigured: false,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          settings: {
            isEmailEnabled: false,
            emailSubject: "Meeting booking approved",
            replyInstructions: "Please reply to this email if your meeting details change.",
            providerConfigured: true,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: vi.fn().mockResolvedValue({
          ok: false,
          reason: "resend_403",
          details: "{\"message\":\"The from domain is not verified.\"}",
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminEmailSettingsPage />);

    expect(screen.getByRole("heading", { name: "Email Settings" })).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Meeting Booking Notification")).toBeInTheDocument();
    expect(screen.queryByLabelText("Sender email")).not.toBeInTheDocument();
    expect(screen.queryByText(/Create Google OAuth credentials/i)).not.toBeInTheDocument();
    expect(screen.getByText("Email is unavailable.")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Send email notifications"));
    await userEvent.clear(screen.getByLabelText("Email subject"));
    await userEvent.type(screen.getByLabelText("Email subject"), "Meeting booking approved");
    await userEvent.clear(screen.getByLabelText("Email body"));
    await userEvent.type(
      screen.getByLabelText("Email body"),
      "Please reply to this email if your meeting details change.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save email settings" }));

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/admin/email-settings", {
      method: "PUT",
      body: JSON.stringify({
        isEmailEnabled: false,
        emailSubject: "Meeting booking approved",
        replyInstructions: "Please reply to this email if your meeting details change.",
      }),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
    });
    expect(await screen.findByText("Email settings saved.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Send test email" }));
    const dialog = screen.getByRole("dialog", { name: "Send test email" });
    expect(dialog).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Recipient email"));
    await userEvent.type(screen.getByLabelText("Recipient email"), "debug@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send test" }));

    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/admin/email-settings/test", {
      method: "POST",
      body: JSON.stringify({ to: "debug@example.com" }),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer admin-token",
      },
    });
    expect(await screen.findByText(/resend_403/)).toBeInTheDocument();
    expect(screen.getByText(/The from domain is not verified/)).toBeInTheDocument();
  });
});
