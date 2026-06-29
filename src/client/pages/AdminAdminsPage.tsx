import { useEffect, useState } from "react";

import { AdminDrawer } from "../components/AdminDrawer";
import { AdminNav } from "../components/AdminNav";
import { adminApi, type AdminAccount, type AdminPayload, type AdminUpdatePayload } from "../api";
import { useAdminI18n } from "../i18n/adminI18n";

type LoadState = "loading" | "loaded" | "error";

const emptyForm: AdminPayload = {
  email: "",
  name: "",
  password: "",
  isEnabled: true,
};

function adminToForm(admin: AdminAccount): AdminUpdatePayload {
  return {
    name: admin.name,
    password: "",
    isEnabled: admin.isEnabled,
  };
}

export function AdminAdminsPage() {
  const { t } = useAdminI18n();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<AdminPayload>(emptyForm);
  const [editForm, setEditForm] = useState<AdminUpdatePayload>({ name: "", password: "", isEnabled: true });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");

  async function load() {
    setLoadState("loading");
    const data = await adminApi.listAdmins();
    setAdmins(data.admins);
    setLoadState("loaded");
  }

  useEffect(() => {
    load().catch(() => {
      setAdmins([]);
      setLoadState("error");
    });
  }, []);

  function openCreate() {
    setEditingId(null);
    setCreateForm(emptyForm);
    setIsDrawerOpen(true);
    setMessage("");
  }

  function edit(admin: AdminAccount) {
    setEditingId(admin.id);
    setEditForm(adminToForm(admin));
    setIsDrawerOpen(true);
    setMessage("");
  }

  function resetEdit() {
    setEditingId(null);
    setCreateForm(emptyForm);
    setEditForm({ name: "", password: "", isEnabled: true });
    setIsDrawerOpen(false);
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      await adminApi.createAdmin(createForm);
      setCreateForm(emptyForm);
      setMessage(t("admins.created"));
      await load();
    } catch {
      setMessage(t("admins.createError"));
    }
  }

  async function update(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) {
      return;
    }
    setMessage("");
    try {
      await adminApi.updateAdmin(editingId, {
        name: editForm.name,
        isEnabled: editForm.isEnabled,
        ...(editForm.password ? { password: editForm.password } : {}),
      });
      resetEdit();
      setMessage(t("admins.updated"));
      await load();
    } catch {
      setMessage(t("admins.updateError"));
    }
  }

  return (
    <section className="admin-layout">
      <AdminNav />

      <main className="admin-main">
        <header className="page-header">
          <div>
            <h1>{t("admins.title")}</h1>
            <p>{t("admins.subtitle")}</p>
          </div>
          <button className="button button--primary" type="button" onClick={openCreate}>
            {t("admins.new")}
          </button>
        </header>

        {message ? <p className="form-message">{message}</p> : null}
        {loadState === "loading" ? <p className="form-message">{t("admins.loading")}</p> : null}
        {loadState === "error" ? (
          <p className="form-message form-message--error" role="alert">
            {t("admins.loadError")}
          </p>
        ) : null}
        {loadState === "loaded" && admins.length === 0 ? <p className="page-footnote">{t("admins.empty")}</p> : null}

        {admins.length > 0 ? (
          <div className="admin-list" aria-label="Admins list">
            {admins.map((admin) => (
              <article className="list-row" key={admin.id}>
                <div className="list-row__content">
                  <strong>{admin.name}</strong>
                  <p>{admin.email}</p>
                </div>
                <span className={`status-badge ${admin.isEnabled ? "status-badge--success" : "status-badge--muted"}`}>
                  {admin.isEnabled ? t("admins.enabled") : t("admins.disabled")}
                </span>
                <button className="button button--secondary" type="button" onClick={() => edit(admin)}>
                  {t("admins.edit")}
                </button>
              </article>
            ))}
          </div>
        ) : null}

        <AdminDrawer
          title={editingId ? t("admins.editTitle") : t("admins.createTitle")}
          description={t("admins.drawerDescription")}
          isOpen={isDrawerOpen}
          onClose={resetEdit}
        >
          <form className="booking-form admin-form-grid" onSubmit={editingId ? update : create}>
            {editingId ? null : (
              <div className="form-row">
                <label htmlFor="admin-email">{t("admins.email")}</label>
                <input
                  id="admin-email"
                  type="email"
                  value={createForm.email}
                  onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
                  required
                />
              </div>
            )}
            <div className="form-row">
              <label htmlFor="admin-name">{t("admins.name")}</label>
              <input
                id="admin-name"
                value={editingId ? editForm.name : createForm.name}
                onChange={(event) =>
                  editingId
                    ? setEditForm({ ...editForm, name: event.target.value })
                    : setCreateForm({ ...createForm, name: event.target.value })
                }
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="admin-password">{t("admins.password")}</label>
              <input
                id="admin-password"
                type="password"
                value={editingId ? editForm.password ?? "" : createForm.password}
                onChange={(event) =>
                  editingId
                    ? setEditForm({ ...editForm, password: event.target.value })
                    : setCreateForm({ ...createForm, password: event.target.value })
                }
                required={!editingId}
              />
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={editingId ? editForm.isEnabled : createForm.isEnabled}
                onChange={(event) =>
                  editingId
                    ? setEditForm({ ...editForm, isEnabled: event.target.checked })
                    : setCreateForm({ ...createForm, isEnabled: event.target.checked })
                }
              />
              {t("admins.enabled")}
            </label>
            <div className="form-actions">
              <button className="button button--primary" type="submit">
                {editingId ? t("admins.save") : t("admins.new")}
              </button>
            </div>
          </form>
        </AdminDrawer>
      </main>
    </section>
  );
}
