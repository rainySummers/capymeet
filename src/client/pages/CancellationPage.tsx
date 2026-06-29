type CancellationPageProps = {
  embedded?: boolean;
  onBack?: () => void;
};

export function CancellationPage({ embedded = false, onBack }: CancellationPageProps = {}) {
  return (
    <main className={embedded ? "embedded-page" : "app-shell"}>
      <header className="page-header">
        <div>
          <h1>Cancellation unavailable</h1>
          <p>Self-service cancellation has been removed. Please contact an administrator if a booking needs changes.</p>
        </div>
        {embedded && onBack ? (
          <button className="button button--secondary" type="button" onClick={onBack}>
            Back to room status
          </button>
        ) : null}
      </header>

      {!embedded ? (
        <p className="page-footnote">
          Need to make a new booking? Visit <a href="/">the booking page</a>.
        </p>
      ) : null}
    </main>
  );
}
