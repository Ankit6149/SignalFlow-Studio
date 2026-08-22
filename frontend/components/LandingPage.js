"use client";

import BrandMark from "./BrandMark";
import PlatformIcon from "./PlatformIcon";
import styles from "./LandingPage.module.css";

const FLOW = [
  ["Capture", "A thought, release, lesson or connected event."],
  ["Shape", "Choose what is worth saying and the angle."],
  ["Create", "Build the right form for each destination."],
  ["Review", "Approve, edit or reject the exact revision."],
  ["Publish", "Schedule only when the final work is approved."],
];

function Arrow() { return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 10h12M11 5.5 15.5 10 11 14.5" /></svg>; }

function StudioPreview() {
  return (
    <div className={styles.preview}>
      <div className={styles.previewTop}><span>Studio</span><small>one story · one flow</small></div>
      <div className={styles.miniFlow}>
        <span className={styles.done}>1</span><i /><span className={styles.done}>2</span><i /><span className={styles.active}>3</span><i /><span>4</span>
      </div>
      <div className={styles.previewBody}>
        <div className={styles.sourceCard}><b>GitHub</b><span>Privacy changed the architecture</span><small>Evidence ready</small></div>
        <div className={styles.storyCard}>
          <small>SELECTED DIRECTION</small>
          <strong>Turn the implementation into a product principle.</strong>
          <div><span>Architecture</span><span>Privacy</span><span>Product</span></div>
        </div>
        <div className={styles.outputCard}>
          <div><span><PlatformIcon platform="linkedin" size={16} branded /> LinkedIn</span><small>Draft 03</small></div>
          <p>Privacy did not become another setting. It became an architectural boundary.</p>
          <div className={styles.checks}><span>✓ Evidence</span><span>✓ Voice</span></div>
        </div>
      </div>
      <div className={styles.previewActions}><button type="button">Request change</button><button type="button">Approve revision</button></div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className={styles.page} id="top">
      <header className={styles.header}>
        <a href="#top"><BrandMark tone="dark" /></a>
        <nav><a href="#flow">How it works</a><a href="#workspace">Workspace</a><a href="#trust">Control</a></nav>
        <a className={styles.openButton} href="/today">Open Studio <Arrow /></a>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroMark} aria-hidden="true"><i /><i /><i /></div>
          <div className={styles.heroCopy}>
            <span className={styles.badge}>Content operating system</span>
            <h1>Work first.<br /><em>Content follows.</em></h1>
            <p>SignalFlow turns real work into clear content decisions — without making you manage the process.</p>
            <div className={styles.heroActions}><a href="/signals">Capture a signal</a><a href="/today">Open your decisions <Arrow /></a></div>
            <div className={styles.proof}><span>GitHub connected</span><span>LinkedIn + X review</span><span>Exact approval</span></div>
          </div>
          <StudioPreview />
        </section>

        <section className={styles.flowSection} id="flow">
          <div className={styles.sectionHeading}><span>THE FLOW</span><h2>One visible path from work to publish.</h2></div>
          <div className={styles.flowGrid}>
            {FLOW.map(([title, body], index) => <article key={title}><b>{index + 1}</b><div><h3>{title}</h3><p>{body}</p></div></article>)}
          </div>
        </section>

        <section className={styles.workspaceSection} id="workspace">
          <div className={styles.sectionHeading}><span>THE STUDIO</span><h2>Each screen has one job.</h2></div>
          <div className={styles.workspaceGrid}>
            <a href="/signals"><small>01 · CAPTURE</small><strong>Signals</strong><p>Save what happened. No forced post, no AI call required.</p><span>Open Signals →</span></a>
            <a href="/plan"><small>02 · SHAPE</small><strong>Plan</strong><p>See opportunities, choose an angle, and resolve the story.</p><span>Open Plan →</span></a>
            <a href="/today"><small>04 · REVIEW</small><strong>Today</strong><p>Only the final decisions that need your judgment.</p><span>Open Today →</span></a>
          </div>
        </section>

        <section className={styles.trustSection} id="trust">
          <div><span>CONTROL</span><h2>Automation stays behind the decision.</h2></div>
          <div className={styles.trustGrid}><article><b>Silence is valid</b><p>Not every signal becomes content.</p></article><article><b>Approval is exact</b><p>Changed work needs approval again.</p></article><article><b>Privacy fails closed</b><p>Protected context never silently downgrades.</p></article></div>
        </section>
      </main>

      <footer><BrandMark tone="dark" compact /><span>Signal → flow → judgment.</span><a href="/today">Open Studio →</a></footer>
    </div>
  );
}
