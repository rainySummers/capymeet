import { PublicLanguageToggle, usePublicI18n } from "../i18n/publicI18n";

type CancellationPageProps = {
  embedded?: boolean;
  onBack?: () => void;
};

export function CancellationPage({ embedded = false, onBack }: CancellationPageProps = {}) {
  const { t } = usePublicI18n();

  return (
    <main className={embedded ? "embedded-page" : "app-shell"}>
      <header className="page-header">
        <div>
          <h1>{t("cancel.title")}</h1>
          <p>{t("cancel.description")}</p>
        </div>
        <div className="page-header__actions">
          <PublicLanguageToggle />
          {embedded && onBack ? (
            <button className="button button--secondary" type="button" onClick={onBack}>
              {t("common.backToRoomStatus")}
            </button>
          ) : null}
        </div>
      </header>

      {!embedded ? (
        <p className="page-footnote">
          {t("cancel.footnoteStart")}<a href="/">{t("cancel.footnoteLink")}</a>{t("cancel.footnoteEnd")}
        </p>
      ) : null}
    </main>
  );
}
