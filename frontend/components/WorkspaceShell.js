"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BrandMark from "./BrandMark";
import GithubSourceConnectionPanel from "./GithubSourceConnectionPanel";
import styles from "./WorkspaceShell.module.css";

const NAV_GROUPS = [
  {
    label: "Decide",
    items: [
      { id: "today", label: "Today", href: "/today", status: "available" },
      { id: "signals", label: "Signals", href: "/signals", status: "available" },
      { id: "plan", label: "Plan", href: "/plan", status: "available" },
    ],
  },
  {
    label: "Make",
    items: [
      { id: "create", label: "Create", href: "/?workspace=create", status: "available" },
      { id: "assets", label: "Assets", status: "planned" },
      { id: "library", label: "Library", href: "/?workspace=library", status: "available" },
      { id: "calendar", label: "Calendar", status: "planned" },
    ],
  },
  {
    label: "System",
    items: [
      { id: "connections", label: "Connections", href: "/?workspace=connections", status: "available" },
      { id: "voice", label: "Voice", href: "/voice", status: "available" },
      { id: "settings", label: "Settings", href: "/?workspace=settings", status: "available" },
    ],
  },
];

function Glyph({ id }) {
  const paths = {
    today: "M5 6.5h14M7 3.5v5M17 3.5v5M5.5 6.5h13v13h-13zM9 11h2M14 11h2M9 15h2M14 15h2",
    signals: "M4 16c3-6 5-3 8-9s5-1 8-4M4 20h16",
    plan: "M5 5h14M5 12h9M5 19h6M17 11l2 2-4 4",
    create: "M12 4v16M4 12h16",
    assets: "M4 5.5h7v6H4zM13 5.5h7v6h-7zM4 13.5h7v6H4zM13 13.5h7v6h-7z",
    library: "M5 4.5h4v15H5zM10.5 4.5h4v15h-4zM16 5.5l3 13.2-3.2.8-3-13.2z",
    calendar: "M5 6.5h14M7 3.5v5M17 3.5v5M5.5 6.5h13v13h-13zM8.5 11h2M13.5 11h2M8.5 15h2M13.5 15h2",
    connections: "M8 8.5 5.5 11a3.5 3.5 0 0 0 5 5l2.5-2.5M16 15.5l2.5-2.5a3.5 3.5 0 0 0-5-5L11 10.5M9 15l6-6",
    voice: "M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3ZM6 11.5a6 6 0 0 0 12 0M12 17.5v3",
    settings: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19 12l2-1-2-3-2.2.4-1.5-1.5.4-2.2-3-2-1 2-2.2-.4-1.5 1.5.4 2.2-2 1 2 3 2.2-.4 1.5 1.5-.4 2.2 3 2 1-2 2.2.4 1.5-1.5z",
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[id]} />
    </svg>
  );
}

export default function WorkspaceShell({
  activeItem,
  children,
  onNavigate,
  statusLabel = "Owner workspace",
  statusTone = "ready",
  contextLabel = "Personal Alpha",
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const itemIndex = useMemo(() => Object.fromEntries(
    NAV_GROUPS.flatMap((group) => group.items.map((item) => [item.id, item])),
  ), []);

  function activate(item) {
    if (item.status !== "available") return;
    setOpen(false);
    if (onNavigate?.[item.id]) onNavigate[item.id]();
  }

  function navItem(item) {
    const isActive = activeItem === item.id;
    const content = (
      <>
        <span className={styles.navIcon}><Glyph id={item.id} /></span>
        <span className={styles.navText}>{item.label}</span>
        {item.status !== "available" && (
          <span className={styles.navStatus}>{item.status === "next" ? "NEXT" : "LATER"}</span>
        )}
      </>
    );

    if (item.status !== "available") {
      return (
        <span
          key={item.id}
          className={`${styles.navItem} ${styles.navItemUnavailable}`}
          aria-disabled="true"
          title={`${item.label} is part of the documented product direction and is not functional yet.`}
        >
          {content}
        </span>
      );
    }

    if (onNavigate?.[item.id]) {
      return (
        <button
          key={item.id}
          type="button"
          className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
          onClick={() => activate(item)}
          aria-current={isActive ? "page" : undefined}
        >
          {content}
        </button>
      );
    }

    return (
      <Link
        key={item.id}
        href={item.href || "/"}
        className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
        aria-current={isActive ? "page" : undefined}
        onClick={() => setOpen(false)}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={`app-shell ${styles.shell}`} data-workspace-route={activeItem || "unknown"}>
      <a className={styles.skipLink} href="#workspace-content">Skip to workspace</a>

      <header className={styles.mobileHeader}>
        <Link href="/" className={styles.mobileBrand} aria-label="SignalFlow home"><BrandMark tone="light" /></Link>
        <button
          type="button"
          className={styles.menuButton}
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="signalflow-workspace-nav"
        >
          <span /><span />
          <b>{itemIndex[activeItem]?.label || "Menu"}</b>
        </button>
      </header>

      {open && <button type="button" className={styles.backdrop} aria-label="Close navigation" onClick={() => setOpen(false)} />}

      <aside className={`${styles.rail} ${open ? styles.railOpen : ""}`} id="signalflow-workspace-nav">
        <div className={styles.railTop}>
          <Link href="/" className={styles.brandLink} aria-label="SignalFlow home"><BrandMark tone="light" /></Link>
          <div className={styles.contextBlock}>
            <span>{contextLabel}</span>
            <small>local owner context</small>
          </div>
        </div>

        <nav className={styles.navigation} aria-label="SignalFlow workspace">
          {NAV_GROUPS.map((group) => (
            <div className={styles.navGroup} key={group.label}>
              <p>{group.label}</p>
              <div>{group.items.map(navItem)}</div>
            </div>
          ))}
        </nav>

        <div className={styles.railFooter}>
          <div className={styles.statusLine} data-tone={statusTone}>
            <i />
            <span>{statusLabel}</span>
          </div>
          <p>Capabilities are shown truthfully. “Next” and “Later” routes are not shipped features.</p>
        </div>
      </aside>

      <div className={styles.workspaceCanvas}>
        {activeItem === "connections" && <GithubSourceConnectionPanel />}
        {children}
      </div>
    </div>
  );
}
