"use client";

import BrandMark from "./BrandMark";
import PlatformIcon from "./PlatformIcon";
import styles from "./LandingPage.module.css";

const FLOW = [
  ["Signal", "A thought, release, lesson, milestone, or connected-source event enters with its context."],
  ["Opportunity", "SignalFlow decides whether it is worth saying anything at all, then proposes distinct directions."],
  ["Narrative", "Voice, boundaries, project context, evidence needs, and the chosen angle become one plan."],
  ["Production", "The plan becomes destination-specific content and, as media capabilities arrive, the right visual form."],
  ["Judgment", "You edit, reject, request a change, or approve one exact visible revision."],
  ["Memory", "What was prepared and what was actually published stay separate so the system can learn without pretending."],
];

const CURRENT = [
  ["Manual capture", "Save ContentSignals without an AI call, then decide when SignalFlow should do the middle work."],
  ["Connected GitHub context", "A verified repository can become bounded ProjectContext, a durable Signal, and a hosted Opportunity."],
  ["Durable planning", "Connected-source Opportunities now continue into hosted Voice, NarrativeStrategy, exact approval, and ContentPiece state."],
  ["Exact review", "LinkedIn and X use immutable revisions with evidence and authenticity checks in the accepted owner path."],
];

const NEXT = [
  ["Automatic evidence + media", "Screenshots and other deterministic evidence should be produced from the same source provenance, not bolted on later."],
  ["Destination × form", "A story may become a post, thread, carousel, image, demo, or nothing. Platform fit is a decision, not a checkbox list."],
  ["Durable publication", "Approved revisions will become immutable publication requests with idempotent execution and confirmed external outcomes."],
];

const TRUST = [
  ["Silence is valid", "A Signal may be ignored, an Opportunity may be skipped, and a destination may be deliberately omitted."],
  ["Approval is revision-bound", "A changed draft is a new decision. SignalFlow never treats an invisible latest version as approved."],
  ["Privacy fails closed", "Protected context cannot silently fall through to a weaker route because a preferred provider is unavailable."],
];

function ArrowIcon() {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 10h12M11 5.5 15.5 10 11 14.5" /></svg>;
}

function SignalGlyph() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <path d="M4 18.5 9.3 12l4.1 3.5L23.5 6" />
      <circle cx="4" cy="18.5" r="1.45" />
      <circle cx="9.3" cy="12" r="1.45" />
      <circle cx="13.4" cy="15.5" r="1.45" />
      <circle cx="23.5" cy="6" r="1.45" />
    </svg>
  );
}

function ProductPreview() {
  return (
    <div className={styles.preview} aria-label="SignalFlow decision workspace preview">
      <div className={styles.previewTop}>
        <span><i /> Today</span>
        <small>2 decisions need you</small>
      </div>
      <article className={styles.decisionCard}>
        <div className={styles.decisionMeta}><span>CONNECTED SOURCE</span><small>SignalFlow Studio · GitHub</small></div>
        <div className={styles.decisionBody}>
          <div className={styles.signalIcon}><SignalGlyph /></div>
          <div>
            <h3>Explain why privacy changed the architecture?</h3>
            <p>The repository evidence supports the decision. The useful story is the trade-off, not the implementation detail.</p>
          </div>
        </div>
        <div className={styles.angleRow}><span>Architecture trade-off</span><span>Product principle</span><span>Something else</span></div>
        <div className={styles.draftPreview}>
          <div><span>LINKEDIN · REVISION 3</span><small>Evidence checked · Voice checked</small></div>
          <p>Privacy did not become another setting. It became an architectural boundary.</p>
        </div>
        <div className={styles.decisionActions}><button type="button">Request change</button><button className={styles.approve} type="button">Approve exact revision</button></div>
      </article>
      <div className={styles.previewFoot}><span>signal → opportunity → plan → judgment</span><small>publishing stays separate</small></div>
    </div>
  );
}

function PlatformPair() {
  return (
    <div className={styles.platformPair} aria-label="Current reviewed destinations">
      <span><PlatformIcon platform="linkedin" size={17} branded /> LinkedIn</span>
      <span><PlatformIcon platform="x" size={17} branded /> X</span>
    </div>
  );
}

export default function LandingPage({ onEnter }) {
  void onEnter;
  return (
    <div className={styles.page} id="top">
      <a className={styles.skipLink} href="#main-content">Skip to main content</a>
      <header className={styles.header}>
        <a className={styles.brand} href="#top" aria-label="SignalFlow home"><BrandMark tone="dark" /></a>
        <nav className={styles.nav} aria-label="Public navigation">
          <a href="#works-now">Works now</a>
          <a href="#how-it-flows">How it flows</a>
          <a href="#trust">Trust</a>
        </nav>
        <div className={styles.headerActions}>
          <a className={styles.secondaryButton} href="/signals">Capture signal</a>
          <a className={styles.primaryButtonSmall} href="/today">Open workspace <ArrowIcon /></a>
        </div>
      </header>

      <main id="main-content">
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={styles.heroAmbient} aria-hidden="true"><span /><span /><span /></div>
          <div className={styles.heroCopy}>
            <div className={styles.liveBadge}><i /> Owner Golden Path is live through exact approval</div>
            <p className={styles.eyebrow}>CONTENT OPERATING SYSTEM</p>
            <h1 id="landing-title">Stay in the work.<br /><em>Let the story find you.</em></h1>
            <p className={styles.heroLead}>SignalFlow watches the useful traces your work leaves behind, decides what is actually worth communicating, shapes it around your Voice and evidence, then returns only the decisions that need you.</p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="/today">See what needs you <ArrowIcon /></a>
              <a className={styles.textButton} href="/signals">Capture something manually</a>
            </div>
            <div className={styles.heroProof}>
              <div><strong>Working now</strong><span>manual + GitHub-connected Signals</span></div>
              <div><strong>Current review</strong><span><PlatformPair /></span></div>
              <div><strong>Control</strong><span>exact revision approval</span></div>
            </div>
          </div>
          <ProductPreview />
        </section>

        <section className={styles.currentSection} id="works-now" aria-labelledby="current-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>WHAT THE PRODUCT CAN DO TODAY</p>
            <h2 id="current-title">The old “make a campaign” Studio is no longer the product idea.</h2>
            <p>SignalFlow now has a real owner loop and a growing hosted source spine. The legacy campaign builder remains compatibility code, but the primary experience is the Content OS: Today, Signals, Plan, Voice, Connections, Library, and the work that connects them.</p>
          </div>
          <div className={styles.currentGrid}>
            {CURRENT.map(([title, body], index) => (
              <article key={title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <div className={styles.currentActions}>
            <a href="/signals">Open Signals <ArrowIcon /></a>
            <a href="/plan">Open Plan <ArrowIcon /></a>
            <a href="/today">Open Today <ArrowIcon /></a>
          </div>
        </section>

        <section className={styles.flowSection} id="how-it-flows" aria-labelledby="flow-title">
          <div className={styles.flowIntro}>
            <p className={styles.eyebrowLight}>THE OPERATING LOOP</p>
            <h2 id="flow-title">Your job is judgment.<br />The middle becomes infrastructure.</h2>
            <p>Everything is designed around one question: what should reach you for a decision, and what can the system safely handle before that?</p>
          </div>
          <div className={styles.flowGrid}>
            {FLOW.map(([title, body], index) => (
              <article key={title}>
                <div className={styles.flowIndex}><span>{String(index + 1).padStart(2, "0")}</span><i /></div>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
          <div className={styles.coreContract}><span>CORE CONTRACT</span><strong>SignalFlow&apos;s job is everything between the work and your judgment.</strong></div>
        </section>

        <section className={styles.nextSection} aria-labelledby="next-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>THE NEXT CONNECTED LAYERS</p>
            <h2 id="next-title">Build the rest behind the same decisions.</h2>
            <p>No fake dashboard expansion. Evidence, media, more forms, and publication should extend the canonical records already working.</p>
          </div>
          <div className={styles.nextGrid}>
            {NEXT.map(([title, body], index) => <article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{body}</p></article>)}
          </div>
        </section>

        <section className={styles.trustSection} id="trust" aria-labelledby="trust-title">
          <div className={styles.trustIntro}>
            <p className={styles.eyebrowLight}>AUTOMATION WITHOUT SURRENDERING CONTROL</p>
            <h2 id="trust-title">Trust is system behavior.</h2>
            <p>Not a settings page full of promises. These are constraints the product is designed to enforce.</p>
          </div>
          <div className={styles.trustGrid}>
            {TRUST.map(([title, body]) => <article key={title}><h3>{title}</h3><p>{body}</p></article>)}
          </div>
          <div className={styles.processingModes}>
            <span>Processing modes</span><div><b>Managed</b><b>Bring your own provider</b><b>Private Hybrid</b><b>Local Only</b></div>
          </div>
        </section>

        <section className={styles.finalSection} aria-labelledby="final-title">
          <p className={styles.eyebrow}>START WHERE THE WORK ACTUALLY IS</p>
          <h2 id="final-title">Keep the signal.<br /><em>Decide when it matters.</em></h2>
          <p>Capture a thought manually, connect the work that already exists, or open Today and handle only what needs your judgment.</p>
          <div className={styles.finalActions}><a href="/signals">Capture signal</a><a href="/today">Open workspace <ArrowIcon /></a></div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div><BrandMark tone="dark" /><p>Content operating system · owner alpha</p></div>
        <nav aria-label="Footer navigation"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="#top">Back to top</a></nav>
      </footer>
    </div>
  );
}
