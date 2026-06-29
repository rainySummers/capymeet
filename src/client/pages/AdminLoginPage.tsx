import { type FormEvent, useState } from "react";

import { setAdminToken } from "../api";
import { AdminLanguageToggle, useAdminI18n } from "../i18n/adminI18n";

export function AdminLoginPage() {
  const { t } = useAdminI18n();
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email") ?? ""),
          password: String(form.get("password") ?? ""),
        }),
      });

      if (!response.ok) {
        setError(t("login.invalid"));
        return;
      }

      const data = (await response.json()) as { token: string };
      setAdminToken(data.token);
      window.location.href = "/admin";
    } catch {
      setError(t("login.invalid"));
    }
  }

  return (
    <main className="app-shell">
      <section className="booking-form admin-login-card">
        <header className="page-header">
          <div>
            <h1>{t("login.title")}</h1>
            <p>{t("login.subtitle")}</p>
          </div>
          <AdminLanguageToggle />
        </header>

        <form className="admin-login-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label htmlFor="admin-email">{t("login.email")}</label>
            <input id="admin-email" name="email" type="email" required aria-label={t("login.emailAria")} />
          </div>

          <div className="form-row">
            <label htmlFor="admin-password">{t("login.password")}</label>
            <input id="admin-password" name="password" type="password" required aria-label={t("login.password")} />
          </div>

          <div className="form-actions">
            <button type="submit">{t("login.submit")}</button>
          </div>
        </form>

        {error ? (
          <p className="form-message form-message--error" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
