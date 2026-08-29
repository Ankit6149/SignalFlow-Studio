"use client";

import BrandMark from "./BrandMark";
import PlatformIcon from "./PlatformIcon";
import styles from "./LandingPage.module.css";

const FLOW = [
  ["Capture", "Manual thoughts and connected work become Signals with their source context intact."],
  ["Shape", "SignalFlow decides whether anything is worth saying, then surfaces the strongest story direction."],
  ["Create", "The chosen story becomes destination-aware content grounded in evidence and your voice."],
  ["Review", "You see the exact revision, its evidence and its fit. Approve it, change it, or reject it."],
  ["Publish", "Only approved work is eligible to move outward. Silence remains a valid outcome."],
];

const PRINCIPLES = [
  ["Starts from work", "No blank-page ritual. The system begins with what actually happened."],
  ["Surfaces judgment", "Automation handles the path between events. You decide what deserves to become public."],
  ["Protects the boundary", "Evidence, voice, privacy and exact-revision approval stay attached to the decision."],
];

function Arrow() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 10h12M11 5.5 15.5 10 11 14.5" /></svg>;
}

function ProductTheatre() {
  return (
    <div className={styles.theatre} aria-label="A SignalFlow story moving from real work to exact review">
      <div className={styles.theatreBar}>
        <div><img src="/icon.svg" alt="" aria-hidden="true" /><span>SignalFlow</span><i>Live story flow</i></div>
        <small>work → signal → story → review</small>
      </div>

      <div className={styles.theatreBody}>
        <section className={styles.sourceLane}>
          <div className={styles.laneLabel}><span>01</span><b>REAL WORK</b></div>
          <article className={styles.sourceEvent}>
            <div className={styles.eventTop}><span className={styles.githubDot}>G</span><b>GitHub</b><small>12 min ago</small></div>
            <strong>Privacy boundaries shipped</strong>
            <p>Architecture changed so protected context can never silently downgrade.</p>
            <div className={styles.eventMeta}><span>release</span><span>evidence linked</span></div>
          </article>
          <article className={`${styles.sourceEvent} ${styles.manualEvent}`}>
            <div className={styles.eventTop}><span className={styles.noteDot}>✦</span><b>Thought</b><small>just now</small></div>
            <strong>“This was bigger than a settings change.”</strong>
            <p>A quick observation becomes context, not another task to manage.</p>
          </article>
          <span className={styles.laneCaption}>Connected events + things you notice</span>
        </section>

        <div className={styles.signalBridge} aria-hidden="true">
          <span /><span /><span />
          <div><img src="/icon.svg" alt="" /></div>
        </div>

        <section className={styles.storyLane}>
          <div className={styles.laneLabel}><span>02</span><b>SIGNALFLOW</b></div>
          <article className={styles.opportunityCard}>
            <div className={styles.opportunityTop}><span>STORY OPPORTUNITY</span><small>92 relevance</small></div>
            <h3>Privacy became an architecture decision, not another setting.</h3>
            <p>Turn the implementation into a product principle: privacy should fail closed by design.</p>
            <div className={styles.storySignals}>
              <span><i>✓</i> source evidence</span>
              <span><i>✓</i> voice applied</span>
              <span><i>✓</i> not previously said</span>
            </div>
          </article>
          <div className={styles.angleStrip}><span>Selected direction</span><b>Explain the decision, not the feature.</b></div>
          <span className={styles.laneCaption}>The system does the synthesis between work and judgment</span>
        </section>

        <div className={styles.outputBridge} aria-hidden="true"><span /><b>ready</b></div>

        <section className={styles.reviewLane}>
          <div className={styles.laneLabel}><span>03</span><b>YOUR JUDGMENT</b></div>
          <article className={styles.draftCard}>
            <div className={styles.draftTop}>
              <span><PlatformIcon platform="linkedin" size={16} branded /> LinkedIn</span>
              <small>Draft 03</small>
            </div>
            <p>Privacy did not become another setting. It became an architectural boundary.</p>
            <p>That changed how the system is allowed to fail — protected context now fails closed instead of silently falling back.</p>
            <div className={styles.reviewChecks}><span>Evidence ✓</span><span>Voice ✓</span></div>
          </article>
          <div className={styles.reviewAction}>
            <div><span>Exact revision</span><small>Changes require approval again</small></div>
            <button type="button">Request change</button>
            <button type="button">Approve</button>
          </div>
          <span className={styles.laneCaption}>You decide. SignalFlow carries everything else.</span>
        </section>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className={styles.page} id="top">
      <header className={styles.header}>
        <a className={styles.brand} href="#top"><BrandMark tone="dark" /></a>
        <nav aria-label="Public navigation"><a href="#why">Why SignalFlow</a><a href="#flow">How it works</a><a href="#control">Control</a></nav>
        <a className={styles.openButton} href="/today">Open Studio <Arrow /></a>
      </header>

      <main id="main-content">
        <section className={styles.hero}>
          <div className={styles.heroGlow} aria-hidden="true"><span /><span /><span /></div>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>CONTENT OPERATING SYSTEM</span>
            <h1>You do the work.<br /><em>SignalFlow finds what’s worth saying.</em></h1>
            <p>SignalFlow sits between your work and the internet. It captures what happened, finds the story, shapes platform-ready content, and brings you the exact revision to judge before anything becomes public.</p>
            <div className={styles.heroActions}>
              <a href="/signals">Enter the Studio <Arrow /></a>
              <a href="#why">See what makes it different</a>
            </div>
            <div className={styles.heroProof}>
              <span>Manual + GitHub signals</span>
              <span>LinkedIn + X narratives</span>
              <span>Evidence-bound review</span>
            </div>
          </div>
          <ProductTheatre />
        </section>

        <section className={styles.statementSection} id="why">
          <div className={styles.statementLead}>
            <span>THE IDEA</span>
            <h2>Content should be a consequence of the work — <em>not another job beside it.</em></h2>
          </div>
          <div className={styles.statementCompare}>
            <div><small>MOST CONTENT TOOLS START HERE</small><p>“What do you want to post today?”</p></div>
            <div className={styles.compareArrow}><Arrow /></div>
            <div><small>SIGNALFLOW STARTS HERE</small><p>“What happened in your work that is actually worth saying?”</p></div>
          </div>
        </section>

        <section className={styles.flowSection} id="flow">
          <div className={styles.sectionHeader}>
            <div><span>ONE OPERATING FLOW</span><h2>From a moment in your work to a public story.</h2></div>
            <p>You should not have to move context between a notes app, an AI chat, a design tool, a scheduler and a spreadsheet just to say one useful thing.</p>
          </div>
          <div className={styles.flowRail}>
            {FLOW.map(([title, body], index) => (
              <article key={title} className={index === 3 ? styles.flowActive : ""}>
                <div><span>{String(index + 1).padStart(2, "0")}</span><i /></div>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.systemSection}>
          <div className={styles.systemIntro}>
            <span>NOT A POST GENERATOR</span>
            <h2>A system that carries context all the way to the decision.</h2>
            <p>SignalFlow is being built around the part content tools usually lose: where the idea came from, why it matters, what evidence supports it, how you speak, and what exact version you approved.</p>
            <a href="/plan">See the planning workspace <Arrow /></a>
          </div>
          <div className={styles.systemDiagram}>
            <div className={styles.diagramOrigin}><small>YOUR WORLD</small><b>Work</b><b>Thoughts</b><b>Connected sources</b></div>
            <div className={styles.diagramCore}><img src="/icon.svg" alt="" /><small>SIGNALFLOW</small><strong>Context becomes narrative.</strong><span>Signal</span><span>Opportunity</span><span>Voice</span><span>Evidence</span></div>
            <div className={styles.diagramDecision}><small>YOUR DECISION</small><b>Approve</b><b>Change</b><b>Reject</b><b>Stay silent</b></div>
          </div>
        </section>

        <section className={styles.controlSection} id="control">
          <div className={styles.sectionHeader}>
            <div><span>HUMAN CONTROL</span><h2>Automation everywhere except the judgment.</h2></div>
            <p>The product is intentionally designed so speed never means silently giving up authorship, privacy, or source truth.</p>
          </div>
          <div className={styles.principleGrid}>
            {PRINCIPLES.map(([title, body], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{title}</h3><p>{body}</p></article>)}
          </div>
        </section>

        <section className={styles.finalSection}>
          <div>
            <span>BUILD FIRST. CONTENT FOLLOWS.</span>
            <h2>Keep doing the work.<br /><em>Let SignalFlow carry the story.</em></h2>
          </div>
          <a href="/signals">Open SignalFlow Studio <Arrow /></a>
        </section>
      </main>

      <footer><BrandMark tone="dark" compact /><span>Signal → story → judgment.</span><a href="/today">Open Studio →</a></footer>
    </div>
  );
}
