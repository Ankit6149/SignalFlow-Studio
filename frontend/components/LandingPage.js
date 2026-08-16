"use client";

import PlatformIcon from "./PlatformIcon";
import styles from "./LandingPage.module.css";

const CURRENT_FOUNDATION = [
  {
    number: "01",
    title: "Bring the source truth",
    description:
      "Start with a real brief, supported links, repository context, files, or notes. SignalFlow keeps source state explicit instead of pretending every input was understood.",
  },
  {
    number: "02",
    title: "Generate through real AI routes",
    description:
      "Use configured hosted, BYOK, local, or custom model routes where the active deployment can actually reach them. No fake template fallback is treated as generation.",
  },
  {
    number: "03",
    title: "Review before anything leaves",
    description:
      "Edit destination drafts, preserve manual changes, save the campaign locally, export it, and use direct publishing only when a configured connector can confirm the result.",
  },
];

const PRODUCT_DIRECTION = [
  { id: "signal", label: "Signal", detail: "Work, thought, source, or event" },
  { id: "opportunity", label: "Opportunity", detail: "Is this worth talking about?" },
  { id: "story", label: "Story", detail: "Angle, narrative, destination fit" },
  { id: "produce", label: "Produce", detail: "Text, image, carousel, demo, video" },
  { id: "judge", label: "Judge", detail: "Edit, reject, approve exact revision" },
  { id: "publish", label: "Publish + remember", detail: "Durable execution and narrative memory" },
];

const MEDIA_FORMS = ["Text", "Real screenshots", "Edited images", "Carousels", "Product demos", "Reels / Shorts"];
const DESTINATIONS = ["linkedin", "x", "instagram", "reddit", "youtube", "tiktok"];

const TRUST_POINTS = [
  {
    title: "Approval stays with you",
    body: "SignalFlow is being built to automate the operational work around content without silently changing the exact text or media you approved.",
  },
  {
    title: "Private context has boundaries",
    body: "The architecture separates standard, confidential, Private Hybrid, and Local Only processing so sensitive sources can fail closed instead of silently taking a weaker route.",
  },
  {
    title: "One system, multiple clients",
    body: "Web is the full workspace; mobile is for quick capture and judgment; the extension is deliberate browser context; a future desktop agent handles trusted local capabilities.",
  },
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3.5 10h12M11 5.5 15.5 10 11 14.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m4 10.5 3.5 3.5L16 6" />
    </svg>
  );
}

function DirectionIcon({ type }) {
  const paths = {
    signal: "M4 14.5 8 10l3 2.5 5-6",
    opportunity: "M10 3.5v2M10 14.5v2M3.5 10h2M14.5 10h2M5.4 5.4l1.4 1.4M13.2 13.2l1.4 1.4M14.6 5.4l-1.4 1.4M6.8 13.2l-1.4 1.4M10 7.3a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4Z",
    story: "M4 5.5h12M4 10h8M4 14.5h10",
    produce: "M4 4.5h12v11H4zM7 12l2-2 2 1.5 2.5-3L16 11",
    judge: "m4 10.5 3.3 3.3L16 5.8",
    publish: "M10 15.5V5M6.5 8.5 10 5l3.5 3.5M4 15.5h12",
  };
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d={paths[type]} />
    </svg>
  );
}

function ProductDirectionPreview() {
  return (
    <div className={styles.directionPreview} aria-label="SignalFlow product direction preview">
      <div className={styles.previewTopline}>
        <span className={styles.directionLabel}>PRODUCT DIRECTION</span>
        <span className={styles.previewStatus}><i /> Approval-first</span>
      </div>

      <div className={styles.todayCard}>
        <div className={styles.todayHeader}>
          <div>
            <span>TODAY</span>
            <strong>2 things may be worth your attention</strong>
          </div>
          <small>Future workspace</small>
        </div>

        <article className={styles.opportunityCard}>
          <div className={styles.opportunityMeta}>
            <span>Worth talking about</span>
            <small>Fresh · strong evidence</small>
          </div>
          <h3>Private repository processing now has a clearer boundary.</h3>
          <p>
            The system can explain why the change matters, propose a few angles, and prepare only the media the story actually needs.
          </p>
          <div className={styles.angleRow}>
            <span>Why this matters</span>
            <span>How it works</span>
            <span>Something else</span>
          </div>
        </article>

        <div className={styles.reviewRow}>
          <div>
            <span className={styles.reviewDot} />
            <div>
              <strong>Your job: judgment</strong>
              <small>SignalFlow handles the operational steps around it.</small>
            </div>
          </div>
          <span className={styles.reviewButton}>Review</span>
        </div>
      </div>

      <div className={styles.previewFootnote}>
        <span>Not presented as live functionality</span>
        <strong>See what works today below</strong>
      </div>
    </div>
  );
}

function CurrentWorkspaceMiniature() {
  return (
    <div className={styles.currentMiniature} aria-label="Current SignalFlow Studio foundation">
      <div className={styles.currentMiniHeader}>
        <span className={styles.liveLabel}>AVAILABLE TODAY</span>
        <span>Current manual Studio foundation</span>
      </div>
      <div className={styles.currentMiniBody}>
        <div className={styles.currentSource}>
          <span>SOURCE</span>
          <strong>Launch notes + repository context</strong>
          <div className={styles.sourceLine}><i /> Product brief <small>usable</small></div>
          <div className={styles.sourceLine}><i /> Repository <small>context</small></div>
          <div className={styles.sourceLine}><i /> Notes.md <small>extracted</small></div>
        </div>
        <div className={styles.currentDraft}>
          <div className={styles.platformStrip} aria-label="Example destination formats">
            {DESTINATIONS.map((platform) => (
              <span key={platform}><PlatformIcon platform={platform} size={15} branded /></span>
            ))}
          </div>
          <span>EDITABLE DRAFT</span>
          <strong>One source, shaped for the destination.</strong>
          <div className={styles.textLines} aria-hidden="true"><i /><i /><i /></div>
          <div className={styles.currentActions}><span>Save</span><span>Copy</span><b>Export</b></div>
        </div>
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
            <a href="#now">Works today</a>
            <a href="#direction">Direction</a>
            <a href="#trust">Trust</a>
          </nav>
          <div className={styles.headerActions}>
            <a className={styles.githubLink} href="https://github.com/Ankit6149/SignalFlow-Studio" target="_blank" rel="noreferrer">GitHub</a>
            <button className={styles.headerButton} type="button" onClick={onEnter}>Open Studio <ArrowIcon /></button>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={styles.heroCopy}>
            <div className={styles.heroBadge}><span>CONTENT OS</span> Built around your judgment, not content busywork</div>
            <p className={styles.eyebrow}>Do the work. Keep the context.</p>
            <h1 id="landing-title">Your work should not become a second content job.</h1>
            <p className={styles.heroLead}>
              SignalFlow is becoming the layer between meaningful work and the communication around it: noticing what may matter, shaping the story, producing the right media, adapting it for the right destinations, and bringing only the decisions back to you.
            </p>
            <p className={styles.heroTruth}>
              <strong>Usable now:</strong> the current Studio already turns manual source context into editable destination drafts with real configured AI routes, local campaign recovery, review, and export.
            </p>
            <div className={styles.heroActions}>
              <button className={styles.primaryButton} type="button" onClick={onEnter}>Open the current Studio <ArrowIcon /></button>
              <a className={styles.secondaryButton} href="#direction">See the product direction</a>
            </div>
            <div className={styles.heroNotes} aria-label="SignalFlow principles">
              <span><CheckIcon /> Approval-first</span>
              <span><CheckIcon /> Provider-neutral direction</span>
              <span><CheckIcon /> Private/local paths by design</span>
            </div>
          </div>

          <ProductDirectionPreview />
        </section>

        <section className={styles.truthBand} aria-label="Current product truth">
          <span className={styles.truthBandLabel}>CURRENT FOUNDATION</span>
          <div><strong>Input</strong><span>Notes, supported links, repository context, files</span></div>
          <div><strong>Generate</strong><span>Real configured model routes</span></div>
          <div><strong>Review</strong><span>Edit-safe destination drafts</span></div>
          <div><strong>Own</strong><span>Save locally, export, portable archive</span></div>
        </section>

        <section className={styles.nowSection} id="now" aria-labelledby="now-title">
          <div className={styles.sectionIntro}>
            <div>
              <span className={styles.sectionTag}>AVAILABLE TODAY</span>
              <p className={styles.eyebrowDark}>A real foundation, not a mock workflow</p>
              <h2 id="now-title">Start with what already works. Build the operating system on top of it.</h2>
            </div>
            <p>
              The current Studio is the manual Create path: it gives SignalFlow explicit source material, uses a real model route, and keeps the resulting drafts reviewable and recoverable. We are preserving those reliability contracts while expanding the product around them.
            </p>
          </div>

          <div className={styles.nowGrid}>
            <div className={styles.foundationCards}>
              {CURRENT_FOUNDATION.map((item) => (
                <article key={item.number} className={styles.foundationCard}>
                  <span>{item.number}</span>
                  <div><h3>{item.title}</h3><p>{item.description}</p></div>
                </article>
              ))}
            </div>
            <CurrentWorkspaceMiniature />
          </div>
        </section>

        <section className={styles.directionSection} id="direction" aria-labelledby="direction-title">
          <div className={styles.directionIntro}>
            <span className={styles.sectionTagDark}>PRODUCT DIRECTION · IN DEVELOPMENT</span>
            <p className={styles.eyebrow}>The low-attention content operating system</p>
            <h2 id="direction-title">SignalFlow should consume the evidence created by your work—not ask you to stop working and manufacture content inputs.</h2>
            <p>
              The permanent product is not a bigger posting wizard. It is a decision system that can turn work, ideas, sources, and connected events into worthwhile opportunities, production plans, reviewable content, and eventually durable publication and memory.
            </p>
          </div>

          <div className={styles.directionFlow}>
            {PRODUCT_DIRECTION.map((item, index) => (
              <article className={styles.directionStep} key={item.id}>
                <span className={styles.directionIcon}><DirectionIcon type={item.id} /></span>
                <small>{String(index + 1).padStart(2, "0")}</small>
                <strong>{item.label}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>

          <div className={styles.directionStatement}>
            <p>THE CORE CONTRACT</p>
            <blockquote>“The user&apos;s job is judgment. SignalFlow&apos;s job is everything between the work and that judgment.”</blockquote>
          </div>
        </section>

        <section className={styles.mediaSection} aria-labelledby="media-title">
          <div className={styles.mediaCopy}>
            <span className={styles.sectionTag}>PRODUCT DIRECTION</span>
            <p className={styles.eyebrowDark}>Media should follow the story</p>
            <h2 id="media-title">Sometimes the right visual is no visual at all.</h2>
            <p>
              SignalFlow is being designed to decide whether a story needs text only, a real screenshot, an edited image, a carousel, a product demo, or a short video. Uploaded media can be reference-only, evidence, final material, or an edit source—those meanings are not interchangeable.
            </p>
            <div className={styles.mediaForms}>
              {MEDIA_FORMS.map((item) => <span key={item}>{item}</span>)}
            </div>
          </div>

          <div className={styles.mediaDecisionCard}>
            <div className={styles.mediaDecisionHeader}>
              <span>MEDIA DECISION</span>
              <small>Future capability</small>
            </div>
            <strong>Private Hybrid architecture story</strong>
            <div className={styles.mediaOption}><span>LinkedIn</span><b>Carousel</b><small>Sequential explanation helps</small></div>
            <div className={styles.mediaOption}><span>X</span><b>One diagram</b><small>Compact proof is enough</small></div>
            <div className={styles.mediaOption}><span>Instagram</span><b>Short Reel</b><small>Visual explanation fits</small></div>
            <div className={styles.mediaOptionMuted}><span>YouTube</span><b>Defer</b><small>Not enough substance yet</small></div>
          </div>
        </section>

        <section className={styles.trustSection} id="trust" aria-labelledby="trust-title">
          <div className={styles.trustIntro}>
            <span className={styles.sectionTagDark}>TRUST IS PRODUCT BEHAVIOR</span>
            <p className={styles.eyebrow}>Automation without surrendering control</p>
            <h2 id="trust-title">The system should know what it may do, what it may send, and what still needs you.</h2>
          </div>

          <div className={styles.trustGrid}>
            {TRUST_POINTS.map((point, index) => (
              <article key={point.title}>
                <span>0{index + 1}</span>
                <h3>{point.title}</h3>
                <p>{point.body}</p>
              </article>
            ))}
          </div>

          <div className={styles.processingModes} aria-label="Target processing modes">
            <span><i /> Standard</span>
            <span><i /> Bring your own provider</span>
            <span><i /> Private Hybrid</span>
            <span><i /> Local Only</span>
            <small>Architecture direction; availability depends on implementation and active deployment capabilities.</small>
          </div>
        </section>

        <section className={styles.finalCta} aria-labelledby="final-cta-title">
          <div>
            <span className={styles.sectionTag}>START WITH THE FOUNDATION</span>
            <p className={styles.eyebrowDark}>Build for real use first</p>
            <h2 id="final-cta-title">Use SignalFlow manually today. We&apos;ll make the surrounding work disappear piece by piece.</h2>
            <p>
              The current workspace is the functional base. The next build phases will make it useful for one owner end to end first, then scale the same contracts into durable cloud, mobile, private, and multi-user deployment paths.
            </p>
          </div>
          <div className={styles.finalActions}>
            <button className={styles.darkButton} type="button" onClick={onEnter}>Open SignalFlow Studio <ArrowIcon /></button>
            <a href="https://github.com/Ankit6149/SignalFlow-Studio" target="_blank" rel="noreferrer">Read the architecture</a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>
          <strong>SignalFlow Studio</strong>
          <p>A content operating system in progress—built around evidence, judgment, and truthful automation.</p>
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
