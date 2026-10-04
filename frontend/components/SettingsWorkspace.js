"use client";

export default function SettingsWorkspace({
  ownerSessionActive,
  ownerKey,
  busy,
  onOwnerKeyChange,
  onUnlockOwner,
  onLockOwner,
  onExportLibrary,
  onClearLibrary,
}) {
  return (
    <main className="secondary-page settings-page" id="workspace-content">
      <header className="secondary-heading">
        <div>
          <p className="eyebrow eyebrow--dark">
            <span /> Product settings
          </p>
          <h1>Keep setup out of the creative flow.</h1>
          <p>Advanced access and provider details live here—not in the middle of every campaign.</p>
        </div>
      </header>

      <div className="settings-grid">
        <section className="settings-card">
          <span className="settings-card__number">01</span>
          <h2>Owner access</h2>
          <p>Unlock server-configured model routes and official social connectors for this hosted instance.</p>
          {ownerSessionActive ? (
            <div className="settings-success">
              <span /> Owner session is active.
              <button onClick={onLockOwner}>Close session</button>
            </div>
          ) : (
            <div className="settings-form">
              <input
                type="password"
                value={ownerKey}
                onChange={(event) => onOwnerKeyChange(event.target.value)}
                placeholder="Owner access key"
              />
              <button className="button button--dark" onClick={onUnlockOwner} disabled={busy}>
                Unlock
              </button>
            </div>
          )}
        </section>

        <section className="settings-card">
          <span className="settings-card__number">02</span>
          <h2>Local data</h2>
          <p>Saved campaigns live in this browser. Export anything important before clearing local storage.</p>
          <div className="settings-actions">
            <button onClick={onExportLibrary}>Export library</button>
            <button className="danger-link" onClick={onClearLibrary}>Clear library</button>
          </div>
        </section>

        <section className="settings-card settings-card--wide">
          <span className="settings-card__number">03</span>
          <h2>Security and publishing policy</h2>
          <p>
            Temporary model keys are used only for the current generation request. Social OAuth tokens
            remain encrypted in HTTP-only cookies and are never returned to page JavaScript or saved in
            the campaign library. Manual channels never claim API publication.
          </p>
          <div className="settings-links">
            <a href="/privacy">Read privacy details</a>
            <a href="/terms">Read product terms</a>
            <a href="/llms.txt">Open AI-readable summary</a>
          </div>
        </section>
      </div>
    </main>
  );
}
