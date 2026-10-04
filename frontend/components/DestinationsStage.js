"use client";

import PlatformIcon from "./PlatformIcon";
import { CHANNEL_GROUPS, channelMeta } from "../lib/studio/studioCatalog.mjs";

export default function DestinationsStage({
  active,
  channels,
  onUseCoreChannels,
  onSelectAllChannels,
  onClearChannels,
  onToggleChannel,
  providerReadiness,
  providerStatusLoading,
  provider,
  form,
  onUpdateForm,
  providerCredentialPlacement,
  availableProviders,
  providerStatuses,
  onSelectProvider,
  providerTest,
  onTestProviderConnection,
  strategyReview,
  onReviewSource,
  onRebuildStrategy,
  busy,
  composeReady,
  sourceAndChannelsReady,
  sourceSignals,
}) {
  return (
    <>
      <div className="panel-kicker panel-kicker--with-actions">
        <span>02</span>
        <b>Channels and output</b>
        <div>
          <button onClick={onUseCoreChannels}>Core</button>
          <button onClick={onSelectAllChannels}>All</button>
          <button onClick={onClearChannels}>Clear</button>
        </div>
      </div>

      <div className="channel-groups">
        {CHANNEL_GROUPS.map((group) => {
          const groupChannels = group.channels.map(channelMeta);
          const selectedCount = groupChannels.filter((channel) => channels.includes(channel.id)).length;
          return (
            <section className="channel-group" key={group.id} aria-labelledby={`channel-group-${group.id}`}>
              <header className="channel-group__header">
                <div>
                  <strong id={`channel-group-${group.id}`}>{group.label}</strong>
                  <small>{group.description}</small>
                </div>
                <span>{selectedCount}/{groupChannels.length} selected</span>
              </header>
              <div className="channel-picker">
                {groupChannels.map((channel) => {
                  const selected = channels.includes(channel.id);
                  return (
                    <button
                      key={channel.id}
                      className={selected ? "channel-option is-selected" : "channel-option"}
                      onClick={() => onToggleChannel(channel.id)}
                      aria-pressed={selected}
                    >
                      <span className="channel-option__mark">
                        <PlatformIcon platform={channel.id} size={18} branded={!selected} />
                      </span>
                      <span>
                        <strong>{channel.label}</strong>
                        <small>{channel.tone}</small>
                      </span>
                      <i>{selected ? "✓" : "+"}</i>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <aside className="model-route-panel" aria-label="Model generation route">
        <header className="model-route-panel__header">
          <div>
            <div className="model-route-panel__eyebrow">Generation engine</div>
            <h3>Model route</h3>
          </div>
          <span className={`model-route-status ${providerReadiness.ready ? "is-ready" : ""}`}>
            {providerStatusLoading ? "Checking" : providerReadiness.ready ? "Ready" : "Setup needed"}
          </span>
        </header>

        <div className="model-route-current" aria-live="polite">
          <div>
            <span>Current route</span>
            <strong>{provider.label}</strong>
          </div>
          <small>{providerReadiness.ready ? "Ready for this campaign" : providerReadiness.reason}</small>
        </div>

        <div className="model-route-core">
          <label className="field">
            <span>Audience</span>
            <input
              value={form.audience}
              onChange={(event) => onUpdateForm("audience", event.target.value)}
            />
          </label>
          {providerCredentialPlacement === "primary" && (
            <label className="field model-route-primary-key">
              <span>Temporary API key</span>
              <input
                type="password"
                value={form.apiKey}
                onChange={(event) => onUpdateForm("apiKey", event.target.value)}
                placeholder={`Required for ${provider.label} on this deployment`}
                autoComplete="off"
              />
              <small>
                No server credential is available for this route. The key is used only for connection testing and generation in this browser session.
              </small>
            </label>
          )}
        </div>

        <details className="model-route-advanced">
          <summary>
            <span>Advanced model settings</span>
            <small>{provider.label}</small>
          </summary>
          <div className="model-route-advanced__content">
            <div className="model-provider-grid" role="list" aria-label="Available model providers">
              {availableProviders.map((item) => {
                const configured = Boolean(providerStatuses[item.id]?.configured);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`model-provider-option ${form.provider === item.id ? "is-selected" : ""}`}
                    onClick={() => onSelectProvider(item.id)}
                    aria-pressed={form.provider === item.id}
                  >
                    <span>{item.label}</span>
                    <small
                      className={configured ? "is-configured" : ""}
                      aria-label={configured ? "Configured on server" : "Not configured on server"}
                    />
                  </button>
                );
              })}
            </div>

            <div className="model-route-fields">
              {providerCredentialPlacement === "advanced" && (
                <label className="field">
                  <span>Temporary API key</span>
                  <input
                    type="password"
                    value={form.apiKey}
                    onChange={(event) => onUpdateForm("apiKey", event.target.value)}
                    placeholder={form.provider === "custom"
                      ? "Optional when the custom endpoint requires authentication"
                      : "Optional temporary override for this request"}
                    autoComplete="off"
                  />
                </label>
              )}
              {["ollama", "lmstudio", "custom"].includes(form.provider) && (
                <label className="field">
                  <span>Base URL</span>
                  <input
                    value={form.baseUrl}
                    onChange={(event) => onUpdateForm("baseUrl", event.target.value)}
                    placeholder={form.provider === "ollama"
                      ? "http://localhost:11434/v1"
                      : form.provider === "lmstudio"
                        ? "http://localhost:1234/v1"
                        : "https://provider.example/v1"}
                  />
                </label>
              )}
              <label className="field">
                <span>Model override</span>
                <input
                  value={form.model}
                  onChange={(event) => onUpdateForm("model", event.target.value)}
                  placeholder={providerStatuses[form.provider]?.defaultModel || "Leave blank for the provider default"}
                />
              </label>
            </div>
          </div>
        </details>

        <div className="model-route-actions">
          <button
            type="button"
            className="button button--outline"
            onClick={onTestProviderConnection}
            disabled={providerTest.status === "testing" || !providerReadiness.ready}
          >
            {providerTest.status === "testing" ? "Testing…" : "Test connection"}
          </button>
        </div>
        <p className={`model-route-message ${providerTest.status === "error" ? "is-error" : ""}`}>
          {providerTest.status === "idle" ? providerReadiness.reason : providerTest.message}
        </p>
        <p className="model-route-note">
          Temporary keys are sent only with this request. SignalFlow does not save them in the campaign library.
        </p>
      </aside>

      {active && strategyReview && (
        <section className="strategy-review-panel" role="alert" aria-labelledby="strategy-review-title">
          <div>
            <span>Strategy quality gate</span>
            <h3 id="strategy-review-title">
              {strategyReview.status === "failed" ? "Strategy failed validation." : "Strategy needs review."}
            </h3>
            <p>No destination drafts were generated from this strategy. Fix the source/model inputs or deliberately rebuild it.</p>
          </div>
          <ul>
            {(strategyReview.issues || []).map((item, index) => (
              <li key={item.code || index}>
                <code>{item.code || "strategy.review"}</code>
                <span>{item.message || String(item)}</span>
              </li>
            ))}
          </ul>
          <div className="strategy-review-panel__actions">
            <button type="button" className="button button--outline" onClick={onReviewSource}>
              Review source
            </button>
            <button
              type="button"
              className="button button--dark"
              onClick={onRebuildStrategy}
              disabled={busy || !composeReady}
            >
              Rebuild strategy
            </button>
          </div>
        </section>
      )}

      {active && (
        <div className="output-empty">
          <div className="compose-readiness">
            <div className="compose-readiness__top">
              <div>
                <span>Campaign readiness</span>
                <h3>
                  {!sourceAndChannelsReady
                    ? "Choose source and destinations."
                    : providerReadiness.ready
                      ? "Ready to shape the campaign."
                      : "Connect a model route."}
                </h3>
              </div>
              <b className={composeReady ? "is-ready" : ""}>
                {composeReady ? "Ready" : providerReadiness.ready ? "Needs source" : "Needs model"}
              </b>
            </div>
            <p>
              {!sourceAndChannelsReady
                ? "Add product evidence and select at least one destination."
                : providerReadiness.ready
                  ? "SignalFlow has enough context and a real model route to build editable drafts."
                  : providerReadiness.reason}
            </p>
            <div className="compose-readiness__metrics">
              <div><strong>{sourceSignals}</strong><span>source signals</span></div>
              <div><strong>{channels.length}</strong><span>destinations</span></div>
              <div><strong>{provider.label}</strong><span>generation route</span></div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
