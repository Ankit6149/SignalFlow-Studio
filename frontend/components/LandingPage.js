"use client";

import PlatformIcon from "./PlatformIcon";
import styles from "./LandingPage.module.css";

const LIVE_PATH = [
  ["01", "Signal", "Keep the thought or work event before it disappears."],
  ["02", "Opportunity", "Decide whether it is worth communicating and choose the angle."],
  ["03", "Voice + Plan", "Resolve the story with your identity, boundaries and evidence needs."],
  ["04", "LinkedIn / X", "Create destination-native immutable revisions."],
  ["05", "Review", "Check evidence and authenticity, edit or request another revision."],
  ["06", "Approve", "Approve one exact revision — never an invisible latest draft."],
];

const TRUST = [
  ["Exact means exact", "Approval points to one immutable revision. A later edit or regeneration has to earn review again."],
  ["Privacy is a routing rule", "Protected context cannot silently fall through to a weaker remote route just because it is convenient."],
  ["Silence is allowed", "A signal can be ignored. A destination can be omitted. An empty calendar slot can remain empty."],
];

const FUTURE = ["Connected-source detection", "Editorial calendar + durable publishing", "Narrative + StyleMemory", "Media intelligence + production"];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 10h13M11 5l5 5-5 5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 3.5v13M3.5 10h13" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m3.8 10.2 3.6 3.7L16.2 5" />
    </svg>
  );
}

function SignalMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 17 9 11.5l3.4 3L20 6" />
      <circle cx="4" cy="17" r="1.2" />
      <circle cx="9" cy="11.5" r="1.2" />
      <circle cx="12.4" cy="14.5" r="1.2" />
      <circle cx="20" cy="6" r="1.2" />
    </svg>
  );
}

function HeroFlowScene() {
  return (
    <div className={styles.heroScene} aria-label="The current SignalFlow owner path">
      <div className={styles.sceneTopline}>
        <span><i /> OWNER PATH · LIVE NOW</span>
        <small>browser-local personal workspace</small>
      </div>

      <div className={styles.sceneSignal}>
        <div className={styles.sceneSignalIcon}><SignalMark /></div>
        <div>
          <span>MANUAL SIGNAL</span>
          <strong>The privacy boundary changed how this product should work.</strong>
          <p>Keep the idea with its context now. Decide whether it deserves a story later.</p>
        </div>
      </div>

      <div className={styles.scenePath}>
        <div className={styles.scenePathLine} aria-hidden="true"><i /><i /><i /><i /></div>
        <div className={styles.sceneDecision}>
          <span>OPPORTUNITY</span>
          <strong>Worth saying?</strong>
          <div><b>Why it matters</b><b>Architecture trade-off</b><b>Something else…</b></div>
        </div>
        <div className={styles.sceneDraft}>
          <div className={styles.sceneDraftHead}>
            <span>LINKEDIN · REVISION 3</span>
            <small>Evidence ✓ &nbsp; Authenticity ✓</small>
          </div>
          <p>Privacy constraints did not become a settings problem. They changed the architecture.</p>
          <div className={styles.sceneDraftActions}><span>Edit</span><span>Request change</span><strong>Approve exact revision</strong></div>
        </div>
      </div>

      <div className={styles.sceneFooter}>
        <span>signal → judgment</span>
        <span>no automatic publishing</span>
      </div>
    </div>
  );
}

function ProductPath() {
  return (
    <div className={styles.productPath}>
      {LIVE_PATH.map(([number, title, detail], index) => (
        <article className={styles.pathStep} key={title}>
          <div className={styles.pathIndex}><span>{number}</span><i aria-hidden="true" /></div>
          <div>
            <small>{index === 5 ? "HUMAN GATE" : "LIVE"}</small>
            <h3>{title}</h3>
            <p>{detail}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function PlatformPair() {
  return (
    <div className={styles.platformPair} aria-label="Current Golden Path destinations">
      <span><PlatformIcon platform="linkedin" size={18} branded /> LinkedIn</span>
      <span><PlatformIcon platform="x" size={18} branded /> X</span>
    </div>
  );
}

export default function LandingPage({ onEnter, brand }) {
  return (
    <div className={styles.page} id="top">
      <a className={styles.skipLink} href="#main-content">Skip to main content</a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a className={styles.logoLink} href="#top" aria-label="SignalFlow Studio home">{brand}</a>
          <nav className={styles.nav} aria-label="Public navigation">
            <a href="#works-now">Works now</a>
            <a href="#how-it-flows">How it works</a>
            <a href="#trust">Trust</a>
          </nav>
          <div className={styles.headerActions}>
            <a className={styles.captureLink} href="/signals"><PlusIcon /> Capture signal</a>
            <button className={styles.headerButton} type="button" onClick={onEnter}>Open Studio <ArrowIcon /></button>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={styles.heroCopy}>
            <div className={styles.statusBadge}><i /> Owner Golden Path is live through exact approval</div>
            <p className={styles.eyebrow}>A content operating system for people with real work to do</p>
            <h1 id="landing-title">Stay in the work.<br /><em>Let the story find you.</em></h1>
            <p className={styles.heroLead}>SignalFlow keeps what your work creates, helps decide what is actually worth communicating, shapes it around your Voice, and brings the final judgment back to you.</p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="/signals">Capture your first signal <ArrowIcon /></a>
              <a className={styles.textButton} href="/plan">See the planning path <ArrowIcon /></a>
            </div>
            <p className={styles.heroTruth}><strong>Working now:</strong> manual ContentSignals → persisted opportunities and angles → explicit Voice → approved NarrativeStrategy → immutable LinkedIn/X drafts → evidence/authenticity checks → exact revision approve/reject. Automatic connected-source detection, publishing, memory and media production remain product direction.</p>
          </div>
          <HeroFlowScene />
          <a className={styles.scrollCue} href="#works-now" aria-label="Continue to what works now"><span /> The useful part, now</a>
        </section>

        <section className={styles.currentSection} id="works-now" aria-labelledby="current-title">
          <div className={styles.sectionIntro}>
            <span className={styles.sectionNumber}>01</span>
            <p className={styles.sectionEyebrow}>PERSONAL ALPHA · FUNCTIONAL NOW</p>
            <h2 id="current-title">Start with the work.<br />Not a content template.</h2>
            <p className={styles.sectionLead}>You can already use the core owner loop without pretending the future automation exists.</p>
          </div>

          <div className={styles.currentComposition}>
            <div className={styles.currentStatement}>
              <span>CAPTURE</span>
              <strong>Something happened. Or you had a thought.</strong>
              <p>Save it as a browser-local ContentSignal. No campaign. No AI call. No pressure to publish.</p>
              <a href="/signals">Open Signals <ArrowIcon /></a>
            </div>
            <div className={styles.currentDivider} aria-hidden="true"><span>then</span></div>
            <div className={styles.currentStatement}>
              <span>JUDGE</span>
              <strong>SignalFlow does the middle work.</strong>
              <p>Opportunity, angle, Voice, plan, destination draft, critics and immutable revision history lead back to one explicit decision.</p>
              <a href="/plan">Open Plan <ArrowIcon /></a>
            </div>
          </div>

          <div className={styles.liveProof}>
            <div><span>DESTINATIONS IN THE GOLDEN PATH</span><PlatformPair /></div>
            <div><span>STORAGE TODAY</span><strong>Browser-local recovery</strong></div>
            <div><span>INFERENCE TODAY</span><strong>Real configured AI generation</strong></div>
            <div><span>OUTPUT FOUNDATION</span><strong>Editable destination-specific drafts + export</strong></div>
          </div>

          <div className={styles.compatibilityLine}>
            <span><CheckIcon /> Current Studio remains additive</span>
            <button type="button" onClick={onEnter}>Open current Studio <ArrowIcon /></button>
          </div>
        </section>

        <section className={styles.flowSection} id="how-it-flows" aria-labelledby="flow-title">
          <div className={styles.flowHeader}>
            <div>
              <span className={styles.sectionNumberLight}>02</span>
              <p className={styles.sectionEyebrowLight}>THE OWNER PATH</p>
              <h2 id="flow-title">Your job is judgment.<br />The middle becomes infrastructure.</h2>
            </div>
            <p>Each stage owns one decision and one durable record. That is what lets this start personal and scale later without replacing the core.</p>
          </div>
          <ProductPath />
          <div className={styles.coreContract}>
            <span>THE CORE CONTRACT</span>
            <p>SignalFlow&apos;s job is everything between the work and your judgment.</p>
          </div>
        </section>

        <section className={styles.directionSection} aria-labelledby="direction-title">
          <div className={styles.directionCopy}>
            <span className={styles.sectionNumber}>03</span>
            <p className={styles.sectionEyebrow}>WHAT COMES AFTER THE CORE LOOP</p>
            <h2 id="direction-title">Automation should extend the path.<br />Not replace your control.</h2>
            <p>Source connections, media production, durable publishing and memory are being added behind the same records and approval rules. They are direction—not claims about what is already shipped.</p>
          </div>
          <div className={styles.futureList}>
            {FUTURE.map((item, index) => (
              <div key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong><small>direction</small></div>
            ))}
          </div>
        </section>

        <section className={styles.trustSection} id="trust" aria-labelledby="trust-title">
          <div className={styles.trustHeader}>
            <div>
              <span className={styles.sectionNumberLight}>04</span>
              <p className={styles.sectionEyebrowLight}>AUTOMATION WITHOUT SURRENDERING CONTROL</p>
              <h2 id="trust-title">Trust is system behavior.</h2>
            </div>
            <p>Not another preferences panel. These rules shape what SignalFlow may do before a provider, worker or destination ever receives the task.</p>
          </div>

          <div className={styles.trustRows}>
            {TRUST.map(([title, body], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>

          <div className={styles.processingModes}>
            <div><i /> Standard</div>
            <div><i /> BYO provider</div>
            <div><i /> Private Hybrid</div>
            <div><i /> Local Only</div>
            <small>Target processing modes. Availability is determined by the implemented capability and privacy contract.</small>
          </div>
        </section>

        <section className={styles.finalSection} aria-labelledby="final-title">
          <p className={styles.sectionEyebrow}>START WITH SOMETHING REAL</p>
          <h2 id="final-title">Keep the thought.<br /><em>Decide later.</em></h2>
          <p>SignalFlow does not need you to become a content operator before it can be useful.</p>
          <div className={styles.finalActions}>
            <a className={styles.finalPrimary} href="/signals">Capture a signal <ArrowIcon /></a>
            <button className={styles.finalStudioButton} type="button" onClick={onEnter}>Open current Studio</button>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>{brand}<p>Content operating system · Personal Alpha</p></div>
        <nav aria-label="Footer navigation"><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="#top">Back to top</a></nav>
      </footer>
    </div>
  );
}
