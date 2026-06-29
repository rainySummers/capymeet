import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { CancellationPage } from "./CancellationPage";

describe("CancellationPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ bookings: [] }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    cleanup();
  });

  test("does not expose phone-based cancellation", () => {
    render(<CancellationPage />);

    expect(screen.getByRole("heading", { name: "Cancellation unavailable" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Phone number")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Find bookings" })).not.toBeInTheDocument();
  });
});
