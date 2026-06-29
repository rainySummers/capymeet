import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { TabletPage } from "./TabletPage";

function room(id: string, name: string) {
  return {
    id,
    name,
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
  };
}

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe("TabletPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = String(input);
        if (path === "/api/tablet/pad-1" && init?.method !== "POST") {
          const boardroom = room("room-1", "Boardroom");
          const huddle = room("room-2", "Huddle Room");
          return jsonResponse({
            device: {
              deviceCode: "pad-1",
              name: "Lobby Tablet",
              defaultRoomId: "room-1",
              isEnabled: true,
            },
            defaultRoom: boardroom,
            rooms: [boardroom, huddle],
          });
        }
        if (path === "/api/tablet/pad-1/heartbeat" && init?.method === "POST") {
          return jsonResponse({ ok: true });
        }
        if (path === "/api/public/rooms") {
          return jsonResponse({
            rooms: [room("room-1", "Boardroom"), room("room-2", "Huddle Room")],
          });
        }
        if (path === "/api/public/bookings?roomId=room-1&date=2026-04-29&timeZone=Europe%2FBerlin") {
          return jsonResponse({
            bookings: [
              {
                id: "booking-3",
                roomId: "room-1",
                title: "Design review",
                contactName: "Cara",
                startTime: "2026-04-29T04:00:00.000Z",
                endTime: "2026-04-29T05:00:00.000Z",
                status: "confirmed",
              },
              {
                id: "booking-1",
                roomId: "room-1",
                title: "Planning",
                contactName: "Alice",
                startTime: "2026-04-29T02:00:00.000Z",
                endTime: "2026-04-29T03:00:00.000Z",
                status: "confirmed",
              },
            ],
          });
        }
        if (path === "/api/public/bookings?roomId=room-2&date=2026-04-29&timeZone=Europe%2FBerlin") {
          return jsonResponse({
            bookings: [
              {
                id: "booking-2",
                roomId: "room-2",
                title: "Focus sync",
                contactName: "Bob",
                startTime: "2026-04-29T04:00:00.000Z",
                endTime: "2026-04-29T05:00:00.000Z",
                status: "pending_approval",
              },
            ],
          });
        }
        return jsonResponse({}, { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    cleanup();
  });

  test("renders the selected default room after load", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-04-29T00:30:00.000Z"));

    render(<TabletPage deviceCode="pad-1" />);

    expect(screen.getByText("Loading tablet...")).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(screen.getByRole("heading", { name: "Boardroom" })).toBeInTheDocument(),
    );
    const statusPanel = screen.getByText("Available").closest(".status-panel");
    expect(statusPanel).toHaveClass("available");
    expect(statusPanel).not.toHaveClass("in-use");
    expect(screen.queryByRole("button", { name: "Book this room" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel by phone" })).not.toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "Booking QR code for Boardroom" })).toHaveAttribute(
      "src",
      expect.stringMatching(/^data:image\/svg\+xml;charset=utf-8,/),
    );
  });

  test("renders the room status and today's bookings in side-by-side panels", async () => {
    render(<TabletPage deviceCode="pad-1" />);

    await vi.waitFor(() =>
      expect(screen.getByRole("heading", { name: "Boardroom" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("main", { name: "Room status" })).toHaveClass("tablet-main-panel");
    expect(screen.getByRole("complementary", { name: "Today's bookings" })).toHaveClass("tablet-side-panel");
  });

  test("shows the company logo in a readable tablet header top bar", async () => {
    render(<TabletPage deviceCode="pad-1" />);

    await vi.waitFor(() =>
      expect(screen.getByRole("heading", { name: "Boardroom" })).toBeInTheDocument(),
    );

    const logo = screen.getByRole("img", { name: "CapyMeet logo" });
    expect(logo).toHaveClass("tablet-company-logo");
    expect(logo.closest(".tablet-logo-surface")).toBeInTheDocument();
    expect(logo.closest(".tablet-header-top")).toHaveClass("tablet-header-top");
    expect(screen.getByRole("heading", { name: "Boardroom" }).closest(".tablet-room-heading")).toBeInTheDocument();
    expect(logo.closest("main")).toHaveClass("tablet-main-panel");
  });

  test("shows the selected room capacity beside the room heading", async () => {
    render(<TabletPage deviceCode="pad-1" />);

    await vi.waitFor(() =>
      expect(screen.getByRole("heading", { name: "Boardroom" })).toBeInTheDocument(),
    );

    const capacity = screen.getByText("(10 people)");
    expect(capacity).toHaveClass("tablet-room-capacity");
    expect(capacity.closest(".tablet-room-title")).toContainElement(
      screen.getByRole("heading", { name: "Boardroom" }),
    );
  });

  test("lets the user switch rooms", async () => {
    render(<TabletPage deviceCode="pad-1" />);

    const switcher = await screen.findByLabelText("Switch room");
    await userEvent.selectOptions(switcher, "room-2");

    expect(screen.getByRole("heading", { name: "Huddle Room" })).toBeInTheDocument();
  });

  test("returns to the default room after 10 seconds without activity after switching rooms", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T00:30:00.000Z"));

    render(<TabletPage deviceCode="pad-1" />);

    await vi.waitFor(() =>
      expect(screen.getByRole("heading", { name: "Boardroom" })).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText("Switch room"), { target: { value: "room-2" } });
    expect(screen.getByRole("heading", { name: "Huddle Room" })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9999);
    });
    expect(screen.getByRole("heading", { name: "Huddle Room" })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(screen.getByRole("heading", { name: "Boardroom" })).toBeInTheDocument();
    expect(screen.getByLabelText("Switch room")).toHaveValue("room-1");
    expect(fetch).toHaveBeenCalledWith(
      "/api/public/bookings?roomId=room-1&date=2026-04-29&timeZone=Europe%2FBerlin",
      expect.any(Object),
    );
  });

  test("resets the switched-room return timer after room switcher activity", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T00:30:00.000Z"));

    render(<TabletPage deviceCode="pad-1" />);

    await vi.waitFor(() =>
      expect(screen.getByRole("heading", { name: "Boardroom" })).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText("Switch room"), { target: { value: "room-2" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });
    fireEvent.pointerDown(screen.getByLabelText("Switch room"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });

    expect(screen.getByRole("heading", { name: "Huddle Room" })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole("heading", { name: "Boardroom" })).toBeInTheDocument();
  });

  test("shows today's bookings for the selected room and refreshes when switching rooms", async () => {
    const user = userEvent.setup();
    vi.spyOn(Date, "now").mockReturnValue(new Date("2026-04-29T00:30:00.000Z").getTime());

    render(<TabletPage deviceCode="pad-1" />);

    expect(await screen.findByText("Planning")).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/04:00/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Switch room"), "room-2");

    expect(await screen.findByText("No bookings today.")).toBeInTheDocument();
    expect(screen.queryByText("Focus sync")).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      "/api/public/bookings?roomId=room-2&date=2026-04-29&timeZone=Europe%2FBerlin",
      expect.any(Object),
    );
  });

  test("sorts tablet bookings from earliest to latest and emphasizes the time range", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-04-29T00:30:00.000Z"));

    render(<TabletPage deviceCode="pad-1" />);

    expect(await screen.findByText("Planning")).toBeInTheDocument();

    const scheduleItems = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(scheduleItems[0]).toHaveTextContent("Planning");
    expect(scheduleItems[0]).toHaveTextContent("Alice");
    expect(scheduleItems[1]).toHaveTextContent("Design review");
    expect(scheduleItems[1]).toHaveTextContent("Cara");
    expect(within(scheduleItems[0]).getByText("04:00 - 05:00")).toHaveClass("tablet-schedule__time");
  });

  test("shows detailed current meeting info and highlights current and upcoming bookings", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-04-29T02:30:00.000Z"));

    render(<TabletPage deviceCode="pad-1" />);

    expect(await screen.findByText("In Use")).toBeInTheDocument();
    const statusPanel = screen.getByText("In Use").closest(".status-panel");
    expect(statusPanel).toHaveClass("in-use");
    expect(statusPanel).not.toHaveClass("available");
    expect(screen.getByText("Now: Planning")).toBeInTheDocument();
    expect(screen.getByText("Host: Alice")).toBeInTheDocument();
    expect(screen.getByText("Time (Germany time (Europe/Berlin)): 04:00 - 05:00")).toBeInTheDocument();
    expect(screen.getByText("Status: Confirmed")).toBeInTheDocument();

    const schedule = screen.getByRole("list");
    const currentItem = within(schedule).getByText("Planning").closest("li");
    const upcomingItem = within(schedule).getByText("Design review").closest("li");
    expect(currentItem).toHaveClass("tablet-schedule__item--current");
    expect(upcomingItem).toHaveClass("tablet-schedule__item--upcoming");
    expect(within(currentItem as HTMLElement).getByText("Now")).toHaveClass("tablet-schedule__state");
    expect(within(upcomingItem as HTMLElement).getByText("Upcoming")).toHaveClass("tablet-schedule__state");
  });

  test("hides pending approval bookings from the tablet schedule and room status", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-04-29T04:30:00.000Z"));

    render(<TabletPage deviceCode="pad-1" />);

    await userEvent.selectOptions(await screen.findByLabelText("Switch room"), "room-2");

    expect(await screen.findByText("Available")).toBeInTheDocument();
    expect(screen.getByText("No bookings today.")).toBeInTheDocument();
    expect(screen.queryByText("Focus sync")).not.toBeInTheDocument();
    expect(screen.queryByText("Pending approval")).not.toBeInTheDocument();
  });

  test("marks past meetings as ended in the tablet schedule", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-04-29T03:30:00.000Z"));

    render(<TabletPage deviceCode="pad-1" />);

    expect(await screen.findByText("Planning")).toBeInTheDocument();

    const schedule = screen.getByRole("list");
    const pastItem = within(schedule).getByText("Planning").closest("li");
    expect(pastItem).toHaveClass("tablet-schedule__item--past");
    expect(within(pastItem as HTMLElement).getByText("Ended")).toHaveClass("tablet-schedule__state");
  });

  test("keeps the room booking QR code visible while in use", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-04-29T02:30:00.000Z"));

    render(<TabletPage deviceCode="pad-1" />);

    expect(await screen.findByText("In Use")).toBeInTheDocument();

    const qrPanel = screen.getByRole("group", { name: "Room booking QR code" });
    expect(qrPanel).toHaveClass("tablet-booking-qr");
    expect(qrPanel.closest("main")).toHaveClass("tablet-main-panel");
    expect(within(qrPanel).getByRole("img", { name: "Booking QR code for Boardroom" })).toBeInTheDocument();
  });

  test("refreshes room status and bookings every 10 seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T00:30:00.000Z"));

    render(<TabletPage deviceCode="pad-1" />);

    await vi.waitFor(() =>
      expect(screen.getByRole("heading", { name: "Boardroom" })).toBeInTheDocument(),
    );

    const bookingsUrl = "/api/public/bookings?roomId=room-1&date=2026-04-29&timeZone=Europe%2FBerlin";
    const initialBookingCalls = vi.mocked(fetch).mock.calls.filter(([input]) => String(input) === bookingsUrl).length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    await vi.waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.filter(([input]) => String(input) === bookingsUrl).length).toBeGreaterThan(
        initialBookingCalls,
      );
      expect(fetch).toHaveBeenCalledWith(
        "/api/tablet/pad-1/heartbeat",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  test("keeps existing booking cards visible while refreshing the schedule", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T00:30:00.000Z"));
    const pendingRefresh = deferredResponse();
    let roomOneBookingCalls = 0;

    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path === "/api/tablet/pad-1" && init?.method !== "POST") {
        const boardroom = room("room-1", "Boardroom");
        return jsonResponse({
          device: {
            deviceCode: "pad-1",
            name: "Lobby Tablet",
            defaultRoomId: "room-1",
            isEnabled: true,
          },
          defaultRoom: boardroom,
          rooms: [boardroom],
        });
      }
      if (path === "/api/tablet/pad-1/heartbeat" && init?.method === "POST") {
        return jsonResponse({ ok: true });
      }
      if (path === "/api/public/bookings?roomId=room-1&date=2026-04-29&timeZone=Europe%2FBerlin") {
        roomOneBookingCalls += 1;
        if (roomOneBookingCalls === 2) {
          return pendingRefresh.promise;
        }
        return jsonResponse({
          bookings: [
            {
              id: "booking-1",
              roomId: "room-1",
              title: "Planning",
              contactName: "Alice",
              startTime: "2026-04-29T02:00:00.000Z",
              endTime: "2026-04-29T03:00:00.000Z",
              status: "confirmed",
            },
          ],
        });
      }
      return jsonResponse({}, { status: 404 });
    });

    render(<TabletPage deviceCode="pad-1" />);

    await vi.waitFor(() => expect(screen.getByText("Planning")).toBeInTheDocument());

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    await act(async () => undefined);

    expect(screen.getByText("Syncing...")).toBeInTheDocument();
    expect(screen.getByText("Planning")).toBeInTheDocument();
    expect(screen.queryByText("Loading bookings...")).not.toBeInTheDocument();

    pendingRefresh.resolve(
      jsonResponse({
        bookings: [
          {
            id: "booking-1",
            roomId: "room-1",
            title: "Planning",
            contactName: "Alice",
            startTime: "2026-04-29T02:00:00.000Z",
            endTime: "2026-04-29T03:00:00.000Z",
            status: "confirmed",
          },
        ],
      }),
    );
  });

  test("does not open booking or cancellation subpages from the tablet", async () => {
    render(<TabletPage deviceCode="pad-1" />);

    await vi.waitFor(() =>
      expect(screen.getByRole("heading", { name: "Boardroom" })).toBeInTheDocument(),
    );

    expect(screen.queryByRole("heading", { name: "Book a Meeting Room" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Cancel a Booking" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Book this room" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel by phone" })).not.toBeInTheDocument();
  });

  test("keeps the status page visible instead of using tablet subpages", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T00:30:00.000Z"));

    render(<TabletPage deviceCode="pad-1" />);

    await vi.waitFor(() =>
      expect(screen.getByRole("heading", { name: "Boardroom" })).toBeInTheDocument(),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(screen.getByRole("heading", { name: "Boardroom" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Book a Meeting Room" })).not.toBeInTheDocument();
  });

  test("keeps the long room booking URL out of the visible QR layout", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T00:30:00.000Z"));

    render(<TabletPage deviceCode="pad-1" />);

    await vi.waitFor(() =>
      expect(screen.getByRole("heading", { name: "Boardroom" })).toBeInTheDocument(),
    );
    expect(screen.queryByText(/roomId=room-1/)).not.toBeInTheDocument();
    expect(screen.getByText("Scan with your mobile device to book this room.")).toBeInTheDocument();
  });

  test("uses the business local date for today's bookings", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-04-28T17:00:00.000Z"));

    render(<TabletPage deviceCode="pad-1" />);

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/public/bookings?roomId=room-1&date=2026-04-28&timeZone=Europe%2FBerlin",
        expect.any(Object),
      ),
    );
  });

  test("starts a heartbeat interval", async () => {
    vi.useFakeTimers();
    render(<TabletPage deviceCode="pad-1" />);

    await vi.waitFor(() =>
      expect(screen.getByRole("heading", { name: "Boardroom" })).toBeInTheDocument(),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    await vi.waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/tablet/pad-1/heartbeat",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});
