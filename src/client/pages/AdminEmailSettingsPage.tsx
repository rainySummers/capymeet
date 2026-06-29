import { useEffect, useState } from "react";

import { AdminDrawer } from "../components/AdminDrawer";
import { AdminNav } from "../components/AdminNav";
import { adminApi, type EmailSettingsPayload } from "../api";
import { useAdminI18n } from "../i18n/adminI18n";

type LoadState = "loading" | "loaded" | "error";

const defaultForm: EmailSettingsPayload = {
  isEmailEnabled: true,
  emailSubject: "Meeting Booking Notification",
  replyInstructions:
    "This is an automated email. Contact your meeting room administrator if your meeting details change.",
};

export function AdminEmailSettingsPage() {
  const { t } = useAdminI18n();
  const [form, setForm] = useState<EmailSettingsPayload>(defaultForm);
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [isTestDrawerOpen, setIsTestDrawerOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");

  async function load() {
    setLoadState("loading");
    try {
      const data = await adminApi.getEmailSettings();
      setForm({
        isEmailEnabled: data.settings.isEmailEnabled,
        emailSubject: data.settings.emailSubject,
        replyInstructions: data.settings.replyInstructions,
      });
      setProviderConfigured(data.settings.providerConfigured);
      setLoadState("loaded");
    } catch {
      setLoadState("error");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      const data = await adminApi.updateEmailSettings(form);
      setForm({
        isEmailEnabled: data.settings.isEmailEnabled,
        emailSubject: data.settings.emailSubject,
        replyInstructions: data.settings.replyInstructions,
      });
      setProviderConfigured(data.settings.providerConfigured);
      setMessage(t("emailSettings.saved"));
    } catch {
      setMessage(t("emailSettings.saveError"));
    }
  }

  async function sendTestEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTestMessage("");
    const result = await adminApi.sendTestEmail(testRecipient);
    if (result.ok) {
      setTestMessage(t("emailSettings.testSent"));
      setIsTestDrawerOpen(false);
      return;
    }
    setTestMessage(`${t("emailSettings.testFailed")} ${result.reason ?? ""} ${result.details ?? ""}`.trim());
  }

  return (
    <section className="admin-layout">
      <AdminNav />

      <main className="admin-main">
        <header className="page-header">
          <div>
            <h1>{t("emailSettings.title")}</h1>
            <p>{t("emailSettings.subtitle")}</p>
          </div>
        </header>

        {loadState === "loading" ? <p className="form-message">{t("emailSettings.loading")}</p> : null}
        {loadState === "error" ? (
          <p className="form-message form-message--error" role="alert">
            {t("emailSettings.loadError")}
          </p>
        ) : null}
        {message ? <p className="form-message">{message}</p> : null}

        <p
          className={`form-message ${providerConfigured ? "form-message--success" : "form-message--error"}`}
          role="status"
        >
          {providerConfigured ? t("emailSettings.providerConfigured") : t("emailSettings.providerMissing")}
        </p>
        {testMessage ? <p className="form-message" role="alert">{testMessage}</p> : null}

        <form className="booking-form admin-form-grid" onSubmit={submit}>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.isEmailEnabled}
              onChange={(event) => setForm({ ...form, isEmailEnabled: event.target.checked })}
            />
            {t("emailSettings.enableNotifications")}
          </label>

          <div className="form-row">
            <label htmlFor="emailSubject">{t("emailSettings.emailSubject")}</label>
            <input
              id="emailSubject"
              type="text"
              required
              value={form.emailSubject}
              onChange={(event) => setForm({ ...form, emailSubject: event.target.value })}
            />
            <small className="form-hint">{t("emailSettings.subjectHint")}</small>
          </div>

          <div className="form-row">
            <label htmlFor="replyInstructions">{t("emailSettings.emailBody")}</label>
            <textarea
              id="replyInstructions"
              required
              rows={5}
              value={form.replyInstructions}
              onChange={(event) => setForm({ ...form, replyInstructions: event.target.value })}
            />
            <small className="form-hint">{t("emailSettings.replyHint")}</small>
          </div>

          <div className="form-actions">
            <button className="button button--primary" type="submit">
              {t("emailSettings.save")}
            </button>
            <button className="button button--secondary" type="button" onClick={() => setIsTestDrawerOpen(true)}>
              {t("emailSettings.sendTest")}
            </button>
          </div>
        </form>

        <AdminDrawer
          title={t("emailSettings.sendTest")}
          description={t("emailSettings.testDescription")}
          isOpen={isTestDrawerOpen}
          onClose={() => setIsTestDrawerOpen(false)}
        >
          <form className="booking-form admin-form-grid" onSubmit={sendTestEmail}>
            <div className="form-row">
              <label htmlFor="testRecipient">{t("emailSettings.testRecipient")}</label>
              <input
                id="testRecipient"
                type="email"
                required
                value={testRecipient}
                onChange={(event) => setTestRecipient(event.target.value)}
              />
              <small className="form-hint">{t("emailSettings.testRecipientHint")}</small>
            </div>
            <div className="form-actions">
              <button className="button button--primary" type="submit">
                {t("emailSettings.sendTestConfirm")}
              </button>
            </div>
          </form>
        </AdminDrawer>
      </main>
    </section>
  );
}
