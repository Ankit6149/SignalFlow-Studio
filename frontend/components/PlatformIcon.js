import React from "react";

const brandColors = {
  linkedin: "#0A66C2",
  x: "#111111",
  instagram: "#C13584",
  reddit: "#FF4500",
  facebook: "#1877F2",
  threads: "#111111",
  youtube: "#FF0000",
  tiktok: "#111111",
  hackernews: "#F0652F",
  newsletter: "#8B6B35",
  blog: "#5F5B53",
  release_notes: "#5C6BC0",
};

const common = (size, color, filled = false) => ({
  width: size,
  height: size,
  display: "block",
  color,
  fill: filled ? "currentColor" : "none",
  stroke: filled ? "none" : "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  flex: "0 0 auto",
});

export default function PlatformIcon({
  platform,
  size = 20,
  color,
  branded = false,
  className = "",
}) {
  const tone = color || (branded ? brandColors[platform] : "currentColor");
  const label = `${platform || "channel"} icon`;

  if (platform === "linkedin") {
    return (
      <svg className={className} viewBox="0 0 24 24" style={common(size, tone, true)} role="img" aria-label={label}>
        <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V8.98h3.42v1.57h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.29ZM5.32 7.41a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14Zm1.78 13.04H3.54V8.98H7.1v11.47Z" />
      </svg>
    );
  }

  if (platform === "x") {
    return (
      <svg className={className} viewBox="0 0 24 24" style={common(size, tone, true)} role="img" aria-label={label}>
        <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.74-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.84L7.08 4.13H5.11l11.97 15.64Z" />
      </svg>
    );
  }

  if (platform === "instagram") {
    return (
      <svg className={className} viewBox="0 0 24 24" style={common(size, tone)} role="img" aria-label={label}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4.1" />
        <circle cx="17.4" cy="6.7" r=".9" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (platform === "reddit") {
    return (
      <svg className={className} viewBox="0 0 24 24" style={common(size, tone)} role="img" aria-label={label}>
        <circle cx="12" cy="13" r="7.1" />
        <circle cx="8.4" cy="12.5" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="15.6" cy="12.5" r="1.1" fill="currentColor" stroke="none" />
        <path d="M9.2 16c1.7 1.2 3.9 1.2 5.6 0M12.6 5.8l1.1-3.1 3.3.8" />
        <circle cx="18.2" cy="4" r="1.5" />
        <path d="M5.3 10.4A2.1 2.1 0 1 0 4.8 14M18.7 10.4a2.1 2.1 0 1 1 .5 3.6" />
      </svg>
    );
  }

  if (platform === "facebook") {
    return (
      <svg className={className} viewBox="0 0 24 24" style={common(size, tone, true)} role="img" aria-label={label}>
        <path d="M13.7 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.25-1.5 1.56-1.5h1.66V4.6a22 22 0 0 0-2.42-.13c-2.4 0-4.04 1.46-4.04 4.15v2.3H7.75V14h2.71v8h3.24Z" />
      </svg>
    );
  }

  if (platform === "threads") {
    return (
      <svg className={className} viewBox="0 0 24 24" style={common(size, tone)} role="img" aria-label={label}>
        <path d="M12 2.7c-5.23 0-8.65 3.74-8.65 9.34 0 5.75 3.42 9.26 8.86 9.26 4.59 0 7.74-2.41 8.31-6.23.45-3.01-.72-5.31-3.18-6.46-1.08-3.02-3.39-4.41-6.28-4.2-2.28.17-4.09 1.4-5.02 3.37" />
        <path d="M8.45 11.23c.84-.66 2.07-1.02 3.43-.98 2.67.08 4.38 1.17 4.22 3.37-.16 2.31-1.87 3.74-4.13 3.74-2.13 0-3.47-1.03-3.47-2.64 0-1.58 1.36-2.56 3.63-2.56 1.61 0 3.05.4 4.18 1.16" />
      </svg>
    );
  }

  if (platform === "youtube") {
    return (
      <svg className={className} viewBox="0 0 24 24" style={common(size, tone, true)} role="img" aria-label={label}>
        <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.1 31.1 0 0 0 0 12a31.1 31.1 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.1 31.1 0 0 0 24 12a31.1 31.1 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12l-6.2 3.6Z" />
      </svg>
    );
  }

  if (platform === "tiktok") {
    return (
      <svg className={className} viewBox="0 0 24 24" style={common(size, tone, true)} role="img" aria-label={label}>
        <path d="M16.6 2c.3 2.4 1.7 3.8 4.1 4v3.1a9 9 0 0 1-4.1-1.2v7.2a6.7 6.7 0 1 1-5.8-6.6v3.2a3.55 3.55 0 1 0 2.6 3.4V2h3.2Z" />
      </svg>
    );
  }

  if (platform === "hackernews") {
    return (
      <svg className={className} viewBox="0 0 24 24" style={common(size, tone)} role="img" aria-label={label}>
        <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" stroke="none" />
        <path d="m8 7 4 6 4-6M12 13v4" stroke="#fff" strokeWidth="1.8" />
      </svg>
    );
  }

  if (platform === "newsletter") {
    return (
      <svg className={className} viewBox="0 0 24 24" style={common(size, tone)} role="img" aria-label={label}>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m4.5 7 7.5 6 7.5-6" />
      </svg>
    );
  }

  if (platform === "release_notes") {
    return (
      <svg className={className} viewBox="0 0 24 24" style={common(size, tone)} role="img" aria-label={label}>
        <path d="M6 3h9l3 3v15H6z" />
        <path d="M15 3v4h4M9 11h6M9 15h6M9 19h4" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 24 24" style={common(size, tone)} role="img" aria-label={label}>
      <path d="M5 5h14v14H5zM8 16 16 8M10 8h6v6" />
    </svg>
  );
}

export function PlatformBadge({ platform, label, branded = false, className = "" }) {
  return (
    <span className={`platform-badge ${className}`.trim()}>
      <PlatformIcon platform={platform} size={17} branded={branded} />
      {label ? <span>{label}</span> : null}
    </span>
  );
}
