import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { PublicBookingPage } from "./PublicBookingPage";

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

describe("PublicBookingPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (path === "/api/public/rooms") {
          return jsonResponse({
            rooms: [
              {
                id: "room-1",
                name: "Boardroom",
                location: "Floor 3",
                capacity: 10,
                equipmentNotes: null,
                isEnabled: true,
                openingHours: "{}",
                minDurationMinutes: 30,
                maxAdvanceDays: 30,
                requiresApproval: false,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          });
        }
        if (path === "/api/public/bookings?roomId=room-1&date=2026-04-29&timeZone=Europe%2FBerlin") {
          return jsonResponse({
            bookings: [
              {
                id: "booking-1",
                roomId: "room-1",
                title: "Planning",
                contactName: "Alice",
                startTime: "2026-04-29T08:00:00.000Z",
                endTime: "2026-04-29T09:00:00.000Z",
                status: "confirmed",
              },
            ],
          });
        }
        if (path === "/api/public/bookings?roomId=room-1&date=2026-04-30&timeZone=Europe%2FBerlin") {
          return jsonResponse({ bookings: [] });
        }
        if (path === "/api/public/bookings" && init?.method === "POST") {
          return jsonResponse({ bookingId: "booking-2", status: "confirmed" }, { status: 201 });
        }
        return jsonResponse({}, { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    cleanup();
  });

  test("renders the booking form fields and loads rooms", async () => {
    render(<PublicBookingPage />);

    expect(
      screen.getByRole("heading", { name: "Book a Meeting Room" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Room/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Meeting title/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Contact name/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Phone")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/)).toBeRequired();
    expect(screen.getByLabelText(/^Booking date/)).toHaveAttribute("type", "date");
    expect(screen.getByLabelText(/^Start time/)).toHaveAttribute("type", "time");
    expect(screen.getByLabelText(/^End time/)).toHaveAttribute("type", "time");
    expect(screen.getByRole("button", { name: "Book room" })).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole("option", { name: /Boardroom/ })).toBeInTheDocument(),
    );
    expect(fetch).toHaveBeenCalledWith("/api/public/rooms", expect.any(Object));
  });

  test("preselects the room requested by a tablet link", async () => {
    render(<PublicBookingPage initialRoomId="room-1" />);

    await waitFor(() => expect(screen.getByRole("option", { name: /Boardroom/ })).toBeInTheDocument());

    expect(screen.getByLabelText(/^Room/)).toHaveValue("room-1");
    expect(fetch).toHaveBeenCalledWith("/api/public/rooms", expect.any(Object));
  });

  test("shows configured opening date range and limits booking date selection", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/public/rooms") {
        return jsonResponse({
          rooms: [
            {
              id: "room-1",
              name: "Boardroom",
              location: "Floor 3",
              capacity: 10,
              equipmentNotes: null,
              isEnabled: true,
              openingHours: '{"startDate":"2026-05-01","endDate":"2026-05-31","start":"08:30","end":"18:00"}',
              minDurationMinutes: 30,
              maxAdvanceDays: 30,
              requiresApproval: false,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        });
      }
      return jsonResponse({}, { status: 404 });
    });

    render(<PublicBookingPage initialRoomId="room-1" />);

    expect(
      await screen.findByText(
        "Bookings are available from May 1 to May 31, from 08:30 to 18:00 (Germany time (Europe/Berlin)).",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^Booking date/)).toHaveAttribute("min", "2026-05-01");
    expect(screen.getByLabelText(/^Booking date/)).toHaveAttribute("max", "2026-05-31");
  });

  test("limits native time inputs to the room booking window", async () => {
    render(<PublicBookingPage initialRoomId="room-1" />);

    await waitFor(() => expect(screen.getByRole("option", { name: /Boardroom/ })).toBeInTheDocument());

    const startTimeInput = screen.getByLabelText(/^Start time/);
    const endTimeInput = screen.getByLabelText(/^End time/);
    expect(startTimeInput).toHaveClass("booking-time-input");
    expect(startTimeInput).not.toHaveAttribute("min");
    expect(startTimeInput).not.toHaveAttribute("max");
    expect(startTimeInput).toHaveAttribute("step", "1800");
    expect(endTimeInput).toHaveClass("booking-time-input");
    expect(endTimeInput).not.toHaveAttribute("min");
    expect(endTimeInput).not.toHaveAttribute("max");
    expect(endTimeInput).toHaveAttribute("step", "1800");
  });

  test("shows booking guidance from the selected room configuration", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/public/rooms") {
        return jsonResponse({
          rooms: [
            {
              id: "room-1",
              name: "Boardroom",
              location: "Floor 3",
              capacity: 10,
              equipmentNotes: null,
              isEnabled: true,
              openingHours: "{}",
              bufferMinutes: 10,
              minDurationMinutes: 45,
              maxDurationMinutes: 90,
              maxAdvanceDays: 14,
              requiresApproval: true,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        });
      }
      return jsonResponse({}, { status: 404 });
    });

    render(<PublicBookingPage initialRoomId="room-1" />);

    await waitFor(() => expect(screen.getByRole("option", { name: /Boardroom/ })).toBeInTheDocument());

    expect(screen.getByText(/Minimum booking duration is 45 minutes\./)).toBeInTheDocument();
    expect(screen.getByText(/Maximum meeting duration is 90 minutes\./)).toBeInTheDocument();
    expect(screen.getByText(/Bookings can be made up to 14 days in advance\./)).toBeInTheDocument();
    expect(screen.getByText(/A 10-minute buffer between meetings is required\./)).toBeInTheDocument();
    expect(screen.getByText(/Bookings require administrator approval\./)).toBeInTheDocument();
    expect(screen.queryByText(/The signing ceremony is limited/)).not.toBeInTheDocument();
  });

  test("does not apply Berlin opening hours as browser-local native time limits", async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/public/rooms") {
        return jsonResponse({
          rooms: [
            {
              id: "room-1",
              name: "Boardroom",
              location: "Floor 3",
              capacity: 10,
              equipmentNotes: null,
              isEnabled: true,
              openingHours: '{"startDate":"2026-05-01","endDate":"2026-05-31","start":"08:30","end":"18:00"}',
              minDurationMinutes: 30,
              maxAdvanceDays: 30,
              requiresApproval: false,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        });
      }
      return jsonResponse({}, { status: 404 });
    });

    render(<PublicBookingPage initialRoomId="room-1" />);

    await waitFor(() => expect(screen.getByRole("option", { name: /Boardroom/ })).toBeInTheDocument());
    expect(screen.getByLabelText(/^Start time/)).not.toHaveAttribute("min");
    expect(screen.getByLabelText(/^Start time/)).not.toHaveAttribute("max");
    expect(screen.getByLabelText(/^End time/)).not.toHaveAttribute("min");
    expect(screen.getByLabelText(/^End time/)).not.toHaveAttribute("max");
  });

  test("immediately flags selected times that conflict with room buffer", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/public/rooms") {
        return jsonResponse({
          rooms: [
            {
              id: "room-1",
              name: "Boardroom",
              location: "Floor 3",
              capacity: 10,
              equipmentNotes: null,
              isEnabled: true,
              openingHours: "{}",
              bufferMinutes: 15,
              minDurationMinutes: 30,
              maxDurationMinutes: 240,
              maxAdvanceDays: 30,
              requiresApproval: false,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        });
      }
      if (path === "/api/public/bookings?roomId=room-1&date=2026-04-29&timeZone=Europe%2FBerlin") {
        return jsonResponse({
          bookings: [
            {
              id: "booking-1",
              roomId: "room-1",
              title: "Planning",
              contactName: "Alice",
              startTime: "2026-04-29T08:00:00.000Z",
              endTime: "2026-04-29T09:00:00.000Z",
              status: "confirmed",
            },
          ],
        });
      }
      if (path === "/api/public/bookings" && init?.method === "POST") {
        return jsonResponse({ bookingId: "booking-2", status: "confirmed" }, { status: 201 });
      }
      return jsonResponse({}, { status: 404 });
    });

    render(<PublicBookingPage initialRoomId="room-1" />);

    await waitFor(() => expect(screen.getByRole("option", { name: /Boardroom/ })).toBeInTheDocument());
    await user.type(screen.getByLabelText(/^Booking date/), "2026-04-29");
    await user.type(screen.getByLabelText(/^Start time/), "11:00");
    await user.type(screen.getByLabelText(/^End time/), "11:30");

    expect(await screen.findByRole("alert")).toHaveTextContent("Selected time is too close to an existing booking buffer.");
    expect(screen.getByLabelText(/^Start time/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/^End time/)).toHaveAttribute("aria-invalid", "true");
  });

  test("immediately flags selected times longer than the room maximum duration", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/public/rooms") {
        return jsonResponse({
          rooms: [
            {
              id: "room-1",
              name: "Boardroom",
              location: "Floor 3",
              capacity: 10,
              equipmentNotes: null,
              isEnabled: true,
              openingHours: "{}",
              bufferMinutes: 5,
              minDurationMinutes: 30,
              maxDurationMinutes: 60,
              maxAdvanceDays: 30,
              requiresApproval: false,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        });
      }
      return jsonResponse({}, { status: 404 });
    });

    render(<PublicBookingPage initialRoomId="room-1" />);

    await waitFor(() => expect(screen.getByRole("option", { name: /Boardroom/ })).toBeInTheDocument());
    await user.type(screen.getByLabelText(/^Booking date/), "2026-04-29");
    await user.type(screen.getByLabelText(/^Start time/), "10:00");
    await user.type(screen.getByLabelText(/^End time/), "11:30");

    expect(await screen.findByRole("alert")).toHaveTextContent("Booking is longer than the maximum duration.");
    expect(screen.getByLabelText(/^Start time/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/^End time/)).toHaveAttribute("aria-invalid", "true");
  });

  test("validates that the end time is after the start time before submitting", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    const user = userEvent.setup();

    render(<PublicBookingPage />);

    await waitFor(() => expect(screen.getByRole("option", { name: /Boardroom/ })).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText(/^Room/), "room-1");
    await user.type(screen.getByLabelText(/^Meeting title/), "Planning");
    await user.type(screen.getByLabelText(/^Contact name/), "Alice");
    await user.type(screen.getByLabelText(/^Email/), "alice@example.com");
    await user.type(screen.getByLabelText(/^Booking date/), "2026-04-29");
    await user.type(screen.getByLabelText(/^Start time/), "16:00");
    await user.type(screen.getByLabelText(/^End time/), "16:00");

    await user.click(screen.getByRole("button", { name: "Book room" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("End time must be after start time.");
    expect(
      fetchMock.mock.calls.some(([input, init]) => String(input) === "/api/public/bookings" && init?.method === "POST"),
    ).toBe(false);
  });

  test("requires email and submits bookings without a phone field", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    const user = userEvent.setup();

    render(<PublicBookingPage />);

    await waitFor(() => expect(screen.getByRole("option", { name: /Boardroom/ })).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText(/^Room/), "room-1");
    await user.type(screen.getByLabelText(/^Meeting title/), "Planning");
    await user.type(screen.getByLabelText(/^Contact name/), "Alice");
    await user.type(screen.getByLabelText(/^Booking date/), "2026-04-30");
    await user.type(screen.getByLabelText(/^Start time/), "16:00");
    await user.type(screen.getByLabelText(/^End time/), "17:00");

    await user.click(screen.getByRole("button", { name: "Book room" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Please fill in all required fields.");
    expect(
      fetchMock.mock.calls.some(([input, init]) => String(input) === "/api/public/bookings" && init?.method === "POST"),
    ).toBe(false);

    await user.type(screen.getByLabelText(/^Email/), "alice@example.com");
    await user.click(screen.getByRole("button", { name: "Book room" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([input, init]) => String(input) === "/api/public/bookings" && init?.method === "POST"),
      ).toBe(true),
    );
    const [, init] = fetchMock.mock.calls.find(
      ([input, requestInit]) => String(input) === "/api/public/bookings" && requestInit?.method === "POST",
    ) as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      roomId: "room-1",
      title: "Planning",
      contactName: "Alice",
      email: "alice@example.com",
      startTime: "2026-04-30T14:00:00.000Z",
      endTime: "2026-04-30T15:00:00.000Z",
    });
    expect(JSON.parse(init.body as string)).not.toHaveProperty("phone");
  });

  test("validates email format before submitting", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    const user = userEvent.setup();

    render(<PublicBookingPage />);

    await waitFor(() => expect(screen.getByRole("option", { name: /Boardroom/ })).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText(/^Room/), "room-1");
    await user.type(screen.getByLabelText(/^Meeting title/), "Planning");
    await user.type(screen.getByLabelText(/^Contact name/), "Alice");
    await user.type(screen.getByLabelText(/^Email/), "not-an-email");
    await user.type(screen.getByLabelText(/^Booking date/), "2026-04-30");
    await user.type(screen.getByLabelText(/^Start time/), "16:00");
    await user.type(screen.getByLabelText(/^End time/), "17:00");

    await user.click(screen.getByRole("button", { name: "Book room" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Please enter a valid email address.");
    expect(screen.getByLabelText(/^Email/)).toHaveAttribute("aria-invalid", "true");
    expect(
      fetchMock.mock.calls.some(([input, init]) => String(input) === "/api/public/bookings" && init?.method === "POST"),
    ).toBe(false);
  });

  test("shows room hours errors returned by the booking API", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/public/rooms") {
        return jsonResponse({
          rooms: [
            {
              id: "room-1",
              name: "Boardroom",
              location: "Floor 3",
              capacity: 10,
              equipmentNotes: null,
              isEnabled: true,
              openingHours: "{}",
              minDurationMinutes: 30,
              maxDurationMinutes: 240,
              maxAdvanceDays: 30,
              requiresApproval: false,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        });
      }
      if (path === "/api/public/bookings" && init?.method === "POST") {
        return jsonResponse(
          { error: "outside_opening_hours" },
          { status: 400 },
        );
      }
      return jsonResponse({}, { status: 404 });
    });


    render(<PublicBookingPage />);

    await waitFor(() => expect(screen.getByRole("option", { name: /Boardroom/ })).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText(/^Room/), "room-1");
    await user.type(screen.getByLabelText(/^Meeting title/), "Late sync");
    await user.type(screen.getByLabelText(/^Contact name/), "Alice");
    await user.type(screen.getByLabelText(/^Email/), "alice@example.com");
    await user.type(screen.getByLabelText(/^Booking date/), "2026-04-30");
    await user.type(screen.getByLabelText(/^Start time/), "16:00");
    await user.type(screen.getByLabelText(/^End time/), "17:00");

    await user.click(screen.getByRole("button", { name: "Book room" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Booking date must be within this room's opening dates.");
  });

  test("shows existing bookings for the selected room and date", async () => {
    const user = userEvent.setup();

    render(<PublicBookingPage initialRoomId="room-1" />);

    await waitFor(() => expect(screen.getByRole("option", { name: /Boardroom/ })).toBeInTheDocument());
    await user.type(screen.getByLabelText(/^Booking date/), "2026-04-29");

    expect(await screen.findByText("meeting1")).toBeInTheDocument();
    expect(screen.queryByText("Planning")).not.toBeInTheDocument();
    expect(screen.queryByText(/Alice/)).not.toBeInTheDocument();
    expect(within(screen.getByRole("list")).getByText(/10:00/)).toBeInTheDocument();
    expect(screen.getAllByText(/Germany time \(Europe\/Berlin\)/).length).toBeGreaterThanOrEqual(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/public/bookings?roomId=room-1&date=2026-04-29&timeZone=Europe%2FBerlin",
      expect.any(Object),
    );
  });

  test("marks conflicting selected times and prevents submission", async () => {
    const fetchMock = fetch as ReturnType<typeof vi.fn>;
    const user = userEvent.setup();

    render(<PublicBookingPage initialRoomId="room-1" />);

    await waitFor(() => expect(screen.getByRole("option", { name: /Boardroom/ })).toBeInTheDocument());
    await user.type(screen.getByLabelText(/^Meeting title/), "Overlap");
    await user.type(screen.getByLabelText(/^Contact name/), "Bob");
    await user.type(screen.getByLabelText(/^Email/), "bob@example.com");
    await user.type(screen.getByLabelText(/^Booking date/), "2026-04-29");
    await user.type(screen.getByLabelText(/^Start time/), "10:30");
    await user.type(screen.getByLabelText(/^End time/), "11:30");

    expect(await screen.findByRole("alert")).toHaveTextContent("Selected time is already occupied by an existing booking.");
    expect(screen.getByLabelText(/^Start time/)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/^End time/)).toHaveAttribute("aria-invalid", "true");

    await user.click(screen.getByRole("button", { name: "Book room" }));

    expect(
      fetchMock.mock.calls.some(([input, init]) => String(input) === "/api/public/bookings" && init?.method === "POST"),
    ).toBe(false);
  });

  test("clears stale bookings while loading a new selected date", async () => {
    const user = userEvent.setup();
    let pendingResolve: ((value: Response) => void) | null = null;
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path === "/api/public/rooms") {
        return jsonResponse({
          rooms: [
            {
              id: "room-1",
              name: "Boardroom",
              location: "Floor 3",
              capacity: 10,
              equipmentNotes: null,
              isEnabled: true,
              openingHours: "{}",
              bufferMinutes: 5,
              minDurationMinutes: 30,
              maxDurationMinutes: 240,
              maxAdvanceDays: 30,
              requiresApproval: false,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        });
      }
      if (path === "/api/public/bookings?roomId=room-1&date=2026-04-29&timeZone=Europe%2FBerlin") {
        return jsonResponse({
          bookings: [
            {
              id: "booking-1",
              roomId: "room-1",
              title: "Planning",
              contactName: "Alice",
              startTime: "2026-04-29T08:00:00.000Z",
              endTime: "2026-04-29T09:00:00.000Z",
              status: "confirmed",
            },
          ],
        });
      }
      if (path === "/api/public/bookings?roomId=room-1&date=2026-04-30&timeZone=Europe%2FBerlin") {
        return new Promise<Response>((resolve) => {
          pendingResolve = resolve;
        });
      }
      return jsonResponse({}, { status: 404 });
    });

    render(<PublicBookingPage initialRoomId="room-1" />);

    await waitFor(() => expect(screen.getByRole("option", { name: /Boardroom/ })).toBeInTheDocument());
    await user.type(screen.getByLabelText(/^Booking date/), "2026-04-29");
    expect(await screen.findByText("meeting1")).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/^Booking date/));
    await user.type(screen.getByLabelText(/^Booking date/), "2026-04-30");

    expect(screen.queryByText("meeting1")).not.toBeInTheDocument();
    expect(screen.getByText("Loading bookings...")).toBeInTheDocument();

    (pendingResolve as ((value: Response) => void) | null)?.(jsonResponse({ bookings: [] }));
  });
});
