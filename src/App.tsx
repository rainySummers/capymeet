import type { ReactNode } from "react";

import { AdminAdminsPage } from "./client/pages/AdminAdminsPage";
import { AdminApprovalsPage } from "./client/pages/AdminApprovalsPage";
import { AdminBookingsPage } from "./client/pages/AdminBookingsPage";
import { AdminDashboardPage } from "./client/pages/AdminDashboardPage";
import { AdminDevicesPage } from "./client/pages/AdminDevicesPage";
import { AdminEmailSettingsPage } from "./client/pages/AdminEmailSettingsPage";
import { AdminLinksPage } from "./client/pages/AdminLinksPage";
import { AdminLoginPage } from "./client/pages/AdminLoginPage";
import { AdminRoomsPage } from "./client/pages/AdminRoomsPage";
import { CancellationPage } from "./client/pages/CancellationPage";
import { PublicBookingPage } from "./client/pages/PublicBookingPage";
import { TabletPage } from "./client/pages/TabletPage";
import { AdminI18nProvider } from "./client/i18n/adminI18n";
import { PublicI18nProvider } from "./client/i18n/publicI18n";
import { getAdminToken } from "./client/api";

export function App() {
  const path = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search);

  function adminPage(page: ReactNode) {
    return <AdminI18nProvider>{page}</AdminI18nProvider>;
  }

  function publicPage(page: ReactNode) {
    return <PublicI18nProvider>{page}</PublicI18nProvider>;
  }

  if (path.startsWith("/admin/login")) {
    return adminPage(<AdminLoginPage />);
  }

  if (path.startsWith("/admin") && !getAdminToken()) {
    window.history.replaceState({}, "", "/admin/login");
    return adminPage(<AdminLoginPage />);
  }

  if (path.startsWith("/admin/links")) {
    return adminPage(<AdminLinksPage />);
  }

  if (path.startsWith("/admin/email-settings")) {
    return adminPage(<AdminEmailSettingsPage />);
  }

  if (path.startsWith("/admin/bookings")) {
    return adminPage(<AdminBookingsPage />);
  }

  if (path.startsWith("/admin/approvals")) {
    return adminPage(<AdminApprovalsPage />);
  }

  if (path.startsWith("/admin/admins")) {
    return adminPage(<AdminAdminsPage />);
  }

  if (path.startsWith("/admin/rooms")) {
    return adminPage(<AdminRoomsPage />);
  }

  if (path.startsWith("/admin/devices")) {
    return adminPage(<AdminDevicesPage />);
  }

  if (path.startsWith("/admin")) {
    return adminPage(<AdminDashboardPage />);
  }

  if (path.startsWith("/pad/")) {
    return publicPage(<TabletPage deviceCode={path.split("/")[2]} />);
  }

  if (path.startsWith("/cancel")) {
    return publicPage(<CancellationPage />);
  }

  if (path.startsWith("/book/")) {
    return publicPage(<PublicBookingPage linkToken={path.split("/")[2]} />);
  }

  return publicPage(<PublicBookingPage initialRoomId={searchParams.get("roomId") ?? ""} />);
}
