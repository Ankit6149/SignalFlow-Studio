"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BrandMark from "./BrandMark";
import GithubSourceConnectionPanel from "./GithubSourceConnectionPanel";
import styles from "./WorkspaceShell.module.css";

const FLOW = [
  { id: "signals", label: "Capture", href: "/signals", status: "available" },
  { id: "plan", label: "Shape", href: "/plan", status: "available" },
  { id: "create", label: "Create", status: "next" },
  { id: "today", label: "Review", href: "/today", status: "available" },
  { id: "calendar", label: "Publish", status: "planned" },
];

const NAV_GROUPS = [
  { label: "Work", items: [
    { id: "today", label: "Today", href: "/today", status: "available" },
    { id: "signals", label: "Signals", href: "/signals", status: "available" },
    { id: "plan", label: "Plan", href: "/plan", status: "available" },
    { id: "library", label: "Library", href: "/?workspace=library", status: "available" },
  ]},
  { label: "System", items: [
    { id: "voice", label: "Voice", href: "/voice", status: "available" },
    { id: "connections", label: "Connections", href: "/?workspace=connections", status: "available" },
    { id: "settings", label: "Settings", href: "/?workspace=settings", status: "available" },
  ]},
];

function Glyph({ id }) {
  const paths = {
    today: "M5 6.5h14M7 3.5v5M17 3.5v5M5.5 6.5h13v13h-13zM9 11h2M14 11h2M9 15h2M14 15h2",
    signals: "M4 16c3-6 5-3 8-9s5-1 8-4M4 20h16",
    plan: "M5 5h14M5 12h9M5 19h6M17 11l2 2-4 4",
    library: "M5 4.5h4v15H5zM10.5 4.5h4v15h-4zM16 5.5l3 13.2-3.2.8-3-13.2z",
    connections: "M8 8.5 5.5 11a3.5 3.5 0 0 0 5 5l2.5-2.5M16 15.5l2.5-2.5a3.5 3.5 0 0 0-5-5L11 10.5M9 15l6-6",
    voice: "M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3ZM6 11.5a6 6 0 0 0 12 0M12 17.5v3",
    settings: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM19 12l2-1-2-3-2.2.4-1.5-1.5.4-2.2-3-2-1 2-2.2-.4-1.5 1.5.4 2.2-2 1 2 3 2.2-.4 1.5 1.5-.4 2.2 3 2 1-2 2.2.4 1.5-1.5z",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[id]} /></svg>;
}

function flowActive(activeItem) {
  if (activeItem === "today") return "today";
  if (activeItem === "plan") return "plan";
  if (activeItem === "signals") return "signals";
  return null;
}

export default function WorkspaceShell({ activeItem, children, onNavigate, statusLabel = "Ready", statusTone = "ready", contextLabel = "Owner workspace" }) {
  const [open, setOpen] = useState(false);
  const activeFlow = flowActive(activeItem);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const itemIndex = useMemo(() => Object.fromEntries(NAV_GROUPS.flatMap((group) => group.items.map((item) => [item.id, item]))), []);

  function navItem(item) {
    const content = <><span className={styles.navIcon}><Glyph id={item.id} /></span><span>{item.label}</span></>;
    if (onNavigate?.[item.id]) return <button key={item.id} type="button" className={`${styles.navItem} ${activeItem === item.id ? styles.navItemActive : ""}`} onClick={() => { setOpen(false); onNavigate[item.id](); }}>{content}</button>;
    return <Link key={item.id} href={item.href} className={`${styles.navItem} ${activeItem === item.id ? styles.navItemActive : ""}`} onClick={() => setOpen(false)}>{content}</Link>;
  }

  return (
    <div className={`app-shell ${styles.shell}`} data-workspace-route={activeItem || "unknown"}>
      <a className={styles.skipLink} href="#workspace-content">Skip to workspace</a>
      <header className={styles.mobileHeader}>
        <Link href="/" className={styles.mobileBrand}><BrandMark tone="dark" /></Link>
        <button type="button" className={styles.menuButton} onClick={() => setOpen((value) => !value)} aria-expanded={open}><span /><span /><b>{itemIndex[activeItem]?.label || "Menu"}</b></button>
      </header>
      {open && <button type="button" className={styles.backdrop} aria-label="Close navigation" onClick={() => setOpen(false)} />}

      <aside className={`${styles.rail} ${open ? styles.railOpen : ""}`}>
        <div className={styles.railTop}>
          <Link href="/" className={styles.brandLink}><BrandMark tone="dark" /></Link>
          <div className={styles.contextBlock}><span>{contextLabel}</span><small>content operating system</small></div>
        </div>
        <nav className={styles.navigation} aria-label="SignalFlow workspace">
          {NAV_GROUPS.map((group) => <div className={styles.navGroup} key={group.label}><p>{group.label}</p><div>{group.items.map(navItem)}</div></div>)}
        </nav>
        <div className={styles.railFooter}><div className={styles.statusLine} data-tone={statusTone}><i /><span>{statusLabel}</span></div></div>
      </aside>

      <div className={styles.mainColumn}>
        <div className={styles.flowBar} aria-label="SignalFlow content flow">
          <div className={styles.flowTitle}><span>Flow</span><small>from signal to publish</small></div>
          <div className={styles.flowSteps}>
            {FLOW.map((step, index) => {
              const active = activeFlow === step.id;
              const available = step.status === "available";
              const node = <><b>{String(index + 1).padStart(2, "0")}</b><span>{step.label}</span>{step.status !== "available" && <small>{step.status === "next" ? "next" : "later"}</small>}</>;
              return available ? <Link key={step.id} href={step.href} className={`${styles.flowStep} ${active ? styles.flowStepActive : ""}`}>{node}</Link> : <span key={step.id} className={`${styles.flowStep} ${styles.flowStepLocked}`}>{node}</span>;
            })}
          </div>
        </div>
        <div className={styles.workspaceCanvas}>
          {activeItem === "connections" && <GithubSourceConnectionPanel />}
          {children}
        </div>
      </div>
    </div>
  );
}
