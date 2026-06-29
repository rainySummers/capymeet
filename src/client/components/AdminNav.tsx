import { AdminLanguageToggle, useAdminI18n } from "../i18n/adminI18n";

const adminNavItems = [
  { href: "/admin", labelKey: "nav.dashboard" },
  { href: "/admin/rooms", labelKey: "nav.rooms" },
  { href: "/admin/devices", labelKey: "nav.devices" },
  { href: "/admin/bookings", labelKey: "nav.bookings" },
  { href: "/admin/approvals", labelKey: "nav.approvals" },
  { href: "/admin/links", labelKey: "nav.links" },
  { href: "/admin/email-settings", labelKey: "nav.emailSettings" },
  { href: "/admin/admins", labelKey: "nav.admins" },
];

export function AdminNav() {
  const { t } = useAdminI18n();

  return (
    <aside className="admin-nav" aria-label={t("admin.navLabel")}>
      <strong>{t("admin.brand")}</strong>
      {adminNavItems.map((item) => (
        <a key={item.href} href={item.href}>
          {t(item.labelKey)}
        </a>
      ))}
      <AdminLanguageToggle />
    </aside>
  );
}
