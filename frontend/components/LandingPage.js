"use client";

import PlatformIcon from "./PlatformIcon";
import styles from "./LandingPage.module.css";

const DESTINATIONS = ["linkedin", "x", "instagram", "reddit", "youtube", "tiktok"];

const FLOW = [
  { label: "Signal", detail: "A thought, change, source or event", state: "live" },
  { label: "Opportunity", detail: "Is it actually worth saying?", state: "next" },
  { label: "Story", detail: "Angle, evidence and destination fit", state: "next" },
  { label: "Produce", detail: "Text, image, carousel, demo or reel", state: "next" },
  { label: "Judge", detail: "Edit, reject or approve the exact revision", state: "principle" },
  { label: "Publish", detail: "Execute only what was approved", state: "next" },
];

const CURRENT = [
  {
    kicker: "CAPTURE",
    title: "Save the thing before you turn it into content.",
    body: "Manual thoughts and topics now live as durable browser-local ContentSignals. They can be edited, snoozed, ignored, archived and recovered without creating a campaign or calling AI.",
    action: "Capture a signal",
    href: "/signals",
  },
  {
    kicker: "CREATE",
    title: "When you already know what you want to say, make it now.",
    body: "The current Studio accepts explicit source context, uses real configured model routes, creates destination-specific drafts, preserves edits and approvals, and keeps campaigns recoverable in the browser.",
    action: "Open Studio",
    enter: true,
  },
];

const TRUST = [
  ["Exact approval", "A newer text or media revision must never silently replace the revision you approved."],
  ["Private by policy", "Sensitive evidence should follow explicit processing rules instead of silently falling back to a weaker route."],
  ["Useful silence", "Not every signal deserves a post. Not every calendar slot needs filling. No content is a valid decision."],
];

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

function SignalIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 16.5 9 11l3.2 2.8L20 5.5" />
      <circle cx="4" cy="16.5" r="1.4" />
      <circle cx="9" cy="11" r="1.4" />
      <circle cx="12.2" cy="13.8" r="1.4" />
      <circle cx="20" cy="5.5" r="1.4" />
    </svg>
  );
}

function HeroProductScene() {
  return (
    <div className={styles.scene} aria-label="SignalFlow product journey preview">
      <div className={`${styles.orbit} ${styles.orbitOne}`} aria-hidden="true" />
      <div className={`${styles.orbit} ${styles.orbitTwo}`} aria-hidden="true" />
      <span className={`${styles.floatingSource} ${styles.sourceOne}`}>thought</span>
      <span className={`${styles.floatingSource} ${styles.sourceTwo}`}>project note</span>
      <span className={`${styles.floatingSource} ${styles.sourceThree}`}>topic</span>

      <div className={styles.productWindow}>
        <div className={styles.windowBar}>
          <div className={styles.windowDots}><i /><i /><i /></div>
          <span>signalflow / today</span>
          <div className={styles.windowStatus}><i /> local workspace</div>
        </div>

        <div className={styles.windowBody}>
          <aside className={styles.miniRail} aria-hidden="true">
            <span className={styles.railMark}>S</span>
            <i className={styles.railActive} />
            <i /><i /><i />
            <span className={styles.railBottom} />
          </aside>

          <div className={styles.sceneContent}>
            <div className={styles.sceneHeading}>
              <div>
                <small>MONDAY · 12:38</small>
                <strong>What deserves your attention?</strong>
              </div>
              <span className={styles.livePill}>LIVE FOUNDATION</span>
            </div>

            <article className={styles.signalCard}>
              <div className={styles.signalGlyph}><SignalIcon /></div>
              <div className={styles.signalText}>
                <div className={styles.signalMeta}><span>MANUAL SIGNAL</span><small>saved locally</small></div>
                <h3>The private-repository processing boundary is finally clear.</h3>
                <p>Keep this thought with the work now. Decide what to do with it later.</p>
                <div className={styles.signalActions}><span>Snooze</span><span>Archive</span><b>Open signal</b></div>
              </div>
            </article>

            <div className={styles.judgmentBridge}>
              <span className={styles.bridgeLine}><i /><i /><i /></span>
              <span>Opportunity intelligence · building next</span>
              <span className={styles.bridgeLine}><i /><i /><i /></span>
            </div>

            <article className={styles.futureDecision}>
              <div>
                <span>NEXT PRODUCT LAYER</span>
                <strong>Worth talking about?</strong>
                <p>SignalFlow will gather the evidence, explain why now, and bring the choice back to you.</p>
              </div>
              <div className={styles.futureChoices}>
                <span>Why it matters</span>
                <span>How it works</span>
                <span>Something else…</span>
              </div>
            </article>
          </div>
        </div>
      </div>

      <div className={styles.sceneCaption}>
        <span><i /> Available now</span>
        <span><i /> Product direction</span>
      </div>
    </div>
  );
}

function MediaCanvas() {
  return (
    <div className={styles.mediaCanvas} aria-label="Future adaptive media production concept">
      <div className={styles.mediaTopbar}>
        <span>ONE STORY</span>
        <small>media follows meaning</small>
      </div>
      <div className={styles.mediaGrid}>
        <div className={styles.textTile}>
          <span>TEXT</span>
          <strong>Sometimes nothing visual improves the story.</strong>
          <i /><i /><i />
        </div>
        <div className={styles.carouselTile}>
          <span>CAROUSEL</span>
          <div className={styles.slideStack} aria-hidden="true"><i /><i /><b>01</b></div>
          <strong>Explain it in sequence.</strong>
        </div>
        <div className={styles.demoTile}>
          <span>DEMO</span>
          <div className={styles.demoScreen} aria-hidden="true"><i /><i /><i /></div>
          <strong>Show the real product.</strong>
        </div>
        <div className={styles.reelTile}>
          <span>REEL</span>
          <div className={styles.reelFrame} aria-hidden="true"><i /><b>0:18</b></div>
          <strong>Cut footage around the point.</strong>
        </div>
      </div>
      <div className={styles.destinationStrip}>
        <span>adapt for</span>
        {DESTINATIONS.map((platform) => (
          <i key={platform}><PlatformIcon platform={platform} size={17} branded /></i>
        ))}
      </div>
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
            <a href="#how-it-flows">How it flows</a>
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
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroCopy}>
            <div className={styles.statusBadge}><i /> The first Signal layer is live</div>
            <p className={styles.eyebrow}>A content operating system for people with real work to do</p>
            <h1 id="landing-title">Stay in the work.<br /><em>Let the story find you.</em></h1>
            <p className={styles.heroLead}>
              SignalFlow keeps the context your work creates, turns the worthwhile parts into communication, and brings the judgment back to you instead of turning content into a second job.
            </p>
            <div className={styles.heroActions}>
              <a className={styles.primaryButton} href="/signals">Capture your first signal <ArrowIcon /></a>
              <button className={styles.secondaryButton} type="button" onClick={onEnter}>Open current Studio</button>
            </div>
            <p className={styles.heroTruth}><strong>Real today:</strong> manual ContentSignals, browser-local recovery, real configured AI generation, editable destination drafts and export. Automatic signal detection and opportunity intelligence are still being built.</p>
          </div>
          <HeroProductScene />
          <a className={styles.scrollCue} href="#works-now" aria-label="Continue to what works now"><span /> What works now</a>
        </section>

        <section className={styles.currentSection} id="works-now" aria-labelledby="current-title">
          <div className={styles.sectionHeader}>
            <span className={styles.sectionNumber}>01</span>
            <div>
              <p className={styles.sectionEyebrow}>USEFUL BEFORE AUTOPILOT</p>
              <h2 id="current-title">Two honest ways to use SignalFlow today.</h2>
            </div>
            <p>One catches the thought before it disappears. The other creates the content when you already know the intent.</p>
          </div>

          <div className={styles.currentGrid}>
            {CURRENT.map((item, index) => (
              <article className={styles.currentCard} key={item.kicker}>
                <div className={styles.currentCardTop}>
                  <span>{item.kicker}</span>
                  <small>0{index + 1}</small>
                </div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                {item.enter ? (
                  <button type="button" onClick={onEnter}>{item.action} <ArrowIcon /></button>
                ) : (
                  <a href={item.href}>{item.action} <ArrowIcon /></a>
                )}
              </article>
            ))}
          </div>

          <div className={styles.truthLine}>
            <span><CheckIcon /> No fake automatic detections</span>
            <span><CheckIcon /> No generation when capturing a Signal</span>
            <span><CheckIcon /> Current Studio remains additive</span>
          </div>
        </section>

        <section className={styles.flowSection} id="how-it-flows" aria-labelledby="flow-title">
          <div className={styles.flowIntro}>
            <span className={styles.sectionNumberLight}>02</span>
            <p className={styles.sectionEyebrowLight}>THE PERMANENT PRODUCT SHAPE</p>
            <h2 id="flow-title">Your job is judgment.<br />The rest becomes a flow.</h2>
            <p>The system should consume evidence created by work, not make you stop working to manufacture inputs for a posting tool.</p>
          </div>

          <div className={styles.flowTrack}>
            {FLOW.map((item, index) => (
              <article className={styles.flowStep} key={item.label} data-state={item.state}>
                <div className={styles.flowMarker}><span>{String(index + 1).padStart(2, "0")}</span><i /></div>
                <div>
                  <small>{item.state === "live" ? "LIVE" : item.state === "principle" ? "CORE RULE" : "BUILDING"}</small>
                  <h3>{item.label}</h3>
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
          </div>

          <div className={styles.coreQuote}>
            <span>THE CORE CONTRACT</span>
            <blockquote>“SignalFlow&apos;s job is everything between the work and your judgment.”</blockquote>
          </div>
        </section>

        <section className={styles.mediaSection} aria-labelledby="media-title">
          <div className={styles.mediaCopy}>
            <span className={styles.sectionNumber}>03</span>
            <p className={styles.sectionEyebrow}>MEDIA INTELLIGENCE · PRODUCT DIRECTION</p>
            <h2 id="media-title">The format should follow the story—not the other way around.</h2>
            <p>A post may need only words. Or a real screenshot. Or a sequence you swipe through. Or edits across footage you uploaded. SignalFlow is designed to decide the media requirement first, then route the work to deterministic tools and specialized AI where appropriate.</p>
            <div className={styles.mediaPrinciples}>
              <span><CheckIcon /> uploaded ≠ publishable</span>
              <span><CheckIcon /> real evidence before generation</span>
              <span><CheckIcon /> exact media revision approval</span>
            </div>
          </div>
          <MediaCanvas />
        </section>

        <section className={styles.trustSection} id="trust" aria-labelledby="trust-title">
          <div className={styles.trustHeader}>
            <div>
              <span className={styles.sectionNumberLight}>04</span>
              <p className={styles.sectionEyebrowLight}>AUTOMATION WITHOUT SURRENDERING CONTROL</p>
              <h2 id="trust-title">Trust is not a settings page.<br />It is system behavior.</h2>
            </div>
            <p>Privacy, approval and restraint are part of the product contract, not disclaimers added after the automation works.</p>
          </div>

          <div className={styles.trustGrid}>
            {TRUST.map(([title, body], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>

          <div className={styles.trustFooter}>
            <div><i /> Standard</div>
            <div><i /> BYO provider</div>
            <div><i /> Private Hybrid</div>
            <div><i /> Local Only</div>
            <small>Target processing modes. Availability is always determined by the active deployment and implemented capability contract.</small>
          </div>
        </section>

        <section className={styles.finalSection} aria-labelledby="final-title">
          <div className={styles.finalOrb} aria-hidden="true" />
          <p className={styles.sectionEyebrow}>START WITH SOMETHING REAL</p>
          <h2 id="final-title">Something happened.<br /><em>Don&apos;t turn it into a content task yet.</em></h2>
          <p>Save the signal. Keep working. SignalFlow will grow outward from that foundation into the full judgment-first system.</p>
          <div className={styles.finalActions}>
            <a className={styles.primaryButton} href="/signals">Capture a signal <ArrowIcon /></a>
            <button className={styles.finalStudioButton} type="button" onClick={onEnter}>Open Studio</button>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>
          <strong>SignalFlow Studio</strong>
          <p>Content operations around your work—not another job beside it.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/llms.txt">AI context</a>
          <a href="https://github.com/Ankit6149/SignalFlow-Studio" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </footer>
    </div>
  );
}
