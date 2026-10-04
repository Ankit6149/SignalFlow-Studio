"use client";

import PlatformIcon from "./PlatformIcon";
import PortableTransferPanel from "./PortableTransferPanel";

function formatDate(value) {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function channelLabel(channels, id) {
  return channels.find((channel) => channel.id === id)?.label || id;
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M4 10h11M11 5l5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function LibraryWorkspace({
  campaigns,
  channels,
  onLibraryChanged,
  onNewCampaign,
  onOpenCampaign,
  onDeleteCampaign,
}) {
  return (
    <main className="secondary-page" id="workspace-content">
      <header className="secondary-heading">
        <div>
          <p className="eyebrow eyebrow--dark">
            <span /> Local library
          </p>
          <h1>Your saved campaigns.</h1>
          <p>Stored in this browser. Nothing here is treated as published.</p>
        </div>
        <button className="button button--dark" onClick={onNewCampaign}>
          New campaign <ArrowIcon />
        </button>
      </header>

      <PortableTransferPanel
        campaigns={campaigns}
        onLibraryChanged={onLibraryChanged}
      />

      {campaigns.length === 0 ? (
        <div className="empty-library">
          <span>◇</span>
          <h2>No saved campaigns yet.</h2>
          <p>Generate a campaign, review it, then save it locally.</p>
        </div>
      ) : (
        <div className="library-grid">
          {campaigns.map((item) => (
            <article key={item.campaignId} className="library-card">
              <div className="library-card__top">
                <span>{item.providerUsed || "Generated"}</span>
                <small>{formatDate(item.updatedAt)}</small>
              </div>
              <h2>{item.title}</h2>
              <div className="library-card__channels">
                {(item.channels || []).map((id) => (
                  <span key={id} title={channelLabel(channels, id)}>
                    <PlatformIcon platform={id} size={14} />
                  </span>
                ))}
              </div>
              <p>
                {item.preview?.slice(0, 170) || "Saved campaign package"}
                {item.preview?.length > 170 ? "…" : ""}
              </p>
              <footer>
                <button onClick={() => onOpenCampaign(item)}>Open campaign</button>
                <button className="danger-link" onClick={() => onDeleteCampaign(item.campaignId)}>
                  Delete
                </button>
              </footer>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
