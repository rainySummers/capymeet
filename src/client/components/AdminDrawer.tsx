import type { ReactNode } from "react";
import { useAdminI18n } from "../i18n/adminI18n";

interface AdminDrawerProps {
  title: string;
  description?: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function AdminDrawer({ title, description, isOpen, onClose, children }: AdminDrawerProps) {
  const { t } = useAdminI18n();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="drawer-overlay" role="presentation">
      <aside className="drawer-panel" role="dialog" aria-modal="true" aria-label={title}>
        <header className="drawer-header">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="button button--ghost" type="button" onClick={onClose} aria-label={t("admin.close")}>
            {t("admin.close")}
          </button>
        </header>
        {children}
      </aside>
    </div>
  );
}
