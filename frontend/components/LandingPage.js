"use client";

import PlatformIcon from "./PlatformIcon";
import styles from "./LandingPage.module.css";

const DESTINATIONS = [
  { id: "linkedin", label: "LinkedIn", type: "Professional" },
  { id: "x", label: "X", type: "Social" },
  { id: "instagram", label: "Instagram", type: "Social" },
  { id: "reddit", label: "Reddit", type: "Community" },
  { id: "facebook", label: "Facebook", type: "Social" },
  { id: "threads", label: "Threads", type: "Social" },
  { id: "youtube", label: "YouTube", type: "Video" },
  { id: "tiktok", label: "TikTok", type: "Video" },
  { id: "hackernews", label: "Hacker News", type: "Community" },
  { id: "newsletter", label: "Newsletter", type: "Owned" },
  { id: "blog", label: "Blog", type: "Owned" },
  { id: "release_notes", label: "Release notes", type: "Product" },
];

const WORKFLOW = [
  {
    number: "01",
    title: "Bring the source truth",
    description:
      "Start with notes, public links, repository context, or text files. Every source keeps an explicit usable, reference-only, processing, failed, or unsupported state.",
    detail: "No generic prompt required",
  },
  {
    number: "02",
    title: "Choose the right routes",
    description:
      "Select only the destinations you need. Use the recommended model path first, while temporary BYOK, local models, and custom gateways stay available under Advanced.",
    detail: "Selections survive recovery",
  },
  {
    number: "03",
    title: "Review before anything leaves",
    description:
      "Edit each destination, save the current campaign, export Markdown or JSON, and publish directly only when a configured official connector confirms success.",
    detail: "Current edits stay authoritative",
  },
];

const TRUST_POINTS = [
  "Saved campaigns remain in the current browser.",
  "Temporary provider keys are excluded from campaign persistence.",
  "Official connector sessions use HTTP-only cookie boundaries.",
  "Manual and export paths stay available when direct publishing is unavailable.",
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

function WorkspacePreview() {
  return (
    <div className={styles.previewScene} aria-label="SignalFlow campaign workspace preview" role="img">
      <div className={styles.previewGlow} aria-hidden="true" />

      <div className={styles.previewWindow}>
        <header className={styles.previewHeader}>
          <div className={styles.previewHeaderTitle}>
            <span className={styles.windowDots} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            Campaign workspace
          </div>
          <span className={styles.previewReady}>Ready to review</span>
        </header>

        <div className={styles.previewBody}>
          <aside className={styles.previewSource}>
            <span className={styles.previewKicker}>SOURCE</span>
            <strong>Launch SignalFlow</strong>
            <p>Product brief, repository context, launch notes, and proof.</p>
            <div className={styles.sourceItem}>
              <span className={styles.sourceIcon}>N</span>
              <div>
                <strong>Product brief</strong>
                <small>Usable evidence</small>
              </div>
            </div>
            <div className={styles.sourceItem}>
              <span className={styles.sourceIcon}>R</span>
              <div>
                <strong>Repository</strong>
                <small>Context attached</small>
              </div>
            </div>
            <div className={styles.sourceItem}>
              <span className={styles.sourceIcon}>F</span>
              <div>
                <strong>Launch notes.md</strong>
                <small>Text extracted</small>
              </div>
            </div>
          </aside>

          <section className={styles.previewEditor}>
            <div className={styles.previewTabs} aria-hidden="true">
              {DESTINATIONS.slice(0, 5).map((destination, index) => (
                <span key={destination.id} className={index === 0 ? styles.previewTabActive : undefined}>
                  <PlatformIcon platform={destination.id} size={14} branded />
                </span>
              ))}
              <small>+7</small>
            </div>
            <span className={styles.previewKicker}>LINKEDIN DRAFT</span>
            <h3>A launch story shaped for every room it enters.</h3>
            <div className={styles.previewText} aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className={styles.previewStatusRow}>
              <span><CheckIcon /> Saved locally</span>
              <span>2,184 / 3,000</span>
            </div>
            <div className={styles.previewActions} aria-hidden="true">
              <span>Save</span>
              <span>Copy &amp; open</span>
              <strong>Export</strong>
            </div>
          </section>
        </div>
      </div>

      <div className={`${styles.previewBadge} ${styles.previewBadgeDestinations}`}>
        <strong>12</strong>
        <span>destination formats</span>
      </div>
      <div className={`${styles.previewBadge} ${styles.previewBadgeReview}`}>
        <span className={styles.badgeDot} />
        <div>
          <strong>Review-first</strong>
          <span>No silent publishing</span>
        </div>
      </div>
      <div className={`${styles.previewBadge} ${styles.previewBadgeProvider}`}>
        <span>MODEL ROUTE</span>
        <strong>Capability-aware</strong>
      </div>
    </div>
  );
}

export default function LandingPage({ onEnter, brand }) {
  return (
    <div className={styles.page} id="top">
      <a className={styles.skipLink} href="#main-content">
        Skip to main content
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a className={styles.logoLink} href="#top" aria-label="SignalFlow Studio home">
            {brand}
          </a>
          <nav className={styles.nav} aria-label="Public navigation">
            <a href="#workflow">Workflow</a>
            <a href="#destinations">Destinations</a>
            <a href="#trust">Trust</a>
          </nav>
          <div className={styles.headerActions}>
            <a
              className={styles.githubLink}
              href="https://github.com/Ankit6149/SignalFlow-Studio"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <button className={styles.headerButton} type="button" onClick={onEnter}>
              Open Studio <ArrowIcon />
            </button>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className={styles.hero} aria-labelledby="landing-title">
          <div className={styles.heroCopy}>
            <div className={styles.heroBadge}>
              <span>REVIEW-FIRST</span>
              Campaign creation without the dashboard maze
            </div>
            <p className={styles.eyebrow}>One source of truth. Every destination.</p>
            <h1 id="landing-title">Turn one product story into a campaign built for every channel.</h1>
            <p className={styles.heroLead}>
              Bring product notes, public links, repository context, and text files. SignalFlow shapes
              editable drafts for twelve destinations, then keeps review, saving, export, and confirmed
              publishing in one clear workspace.
            </p>
            <div className={styles.heroActions}>
              <button className={styles.primaryButton} type="button" onClick={onEnter}>
                Create a campaign <ArrowIcon />
              </button>
              <a
                className={styles.secondaryButton}
                href="https://github.com/Ankit6149/SignalFlow-Studio"
                target="_blank"
                rel="noreferrer"
              >
                Explore the repository
              </a>
            </div>
            <div className={styles.heroNotes} aria-label="Product highlights">
              <span><CheckIcon /> 12 destination formats</span>
              <span><CheckIcon /> Browser-local campaign library</span>
              <span><CheckIcon /> Real configured model routes</span>
            </div>
          </div>

          <WorkspacePreview />
        </section>

        <section className={styles.proofBar} aria-label="SignalFlow product boundaries">
          <div>
            <span>INPUT</span>
            <strong>Notes, links, repositories, files</strong>
          </div>
          <div>
            <span>OUTPUT</span>
            <strong>12 destination-specific drafts</strong>
          </div>
          <div>
            <span>CONTROL</span>
            <strong>Edit, save, export, approve</strong>
          </div>
          <div>
            <span>TRUTH</span>
            <strong>Publish only after confirmation</strong>
          </div>
        </section>

        <section className={styles.workflowWrap} id="workflow" aria-labelledby="workflow-title">
          <div className={styles.workflowPanel}>
            <div className={styles.sectionHeadingDark}>
              <p className={styles.eyebrowDark}>The complete working path</p>
              <h2 id="workflow-title">Clarity before content volume.</h2>
              <p>
                SignalFlow keeps the product journey deliberate: establish the evidence, choose the routes,
                then shape every current draft before export or publishing.
              </p>
            </div>

            <div className={styles.workflowGrid}>
              {WORKFLOW.map((step) => (
                <article className={styles.workflowCard} key={step.number}>
                  <span className={styles.workflowNumber}>{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                  <small><CheckIcon /> {step.detail}</small>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.productStory} aria-labelledby="product-story-title">
          <div className={styles.productStoryCopy}>
            <p className={styles.eyebrow}>Built like a workspace, not a prompt box</p>
            <h2 id="product-story-title">Your source, model route, drafts, and decisions stay connected.</h2>
            <p>
              A campaign is more than generated text. SignalFlow keeps the current source snapshot, model
              route, channel state, edits, versions, save status, and export boundaries together so the work
              remains understandable after refresh and recovery.
            </p>
            <button className={styles.darkButton} type="button" onClick={onEnter}>
              Open the campaign workspace <ArrowIcon />
            </button>
          </div>

          <div className={styles.storyRail}>
            <article>
              <span>01</span>
              <div>
                <strong>Source state stays explicit</strong>
                <p>Usable, reference-only, processing, failed, and unsupported inputs do not collapse into one misleading count.</p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <strong>Manual edits remain authoritative</strong>
                <p>Regeneration and recovery preserve unrelated channel edits instead of silently replacing them.</p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <strong>Every route tells the truth</strong>
                <p>Availability comes from deployment and session capabilities, not optimistic client assumptions.</p>
              </div>
            </article>
          </div>
        </section>

        <section className={styles.destinations} id="destinations" aria-labelledby="destinations-title">
          <div className={styles.sectionHeadingLight}>
            <div>
              <p className={styles.eyebrow}>One campaign, native formats</p>
              <h2 id="destinations-title">Every destination gets the format it actually needs.</h2>
            </div>
            <p>
              Professional posts, social captions, community discussions, video packages, newsletters,
              articles, and release notes stay connected to one campaign without becoming identical copies.
            </p>
          </div>

          <div className={styles.destinationGrid}>
            {DESTINATIONS.map((destination) => (
              <article className={styles.destinationCard} key={destination.id}>
                <span className={styles.destinationIcon}>
                  <PlatformIcon platform={destination.id} size={22} branded />
                </span>
                <div>
                  <strong>{destination.label}</strong>
                  <small>{destination.type}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.trust} id="trust" aria-labelledby="trust-title">
          <div className={styles.trustCopy}>
            <p className={styles.eyebrowDark}>Clear product boundaries</p>
            <h2 id="trust-title">Private by design where the current product can prove it.</h2>
            <p>
              SignalFlow distinguishes browser-local campaign storage, temporary provider credentials,
              configured server routes, local model endpoints, and official social connectors. It does not
              describe a capability as ready when the active session cannot execute it.
            </p>
          </div>

          <div className={styles.trustGrid}>
            <article className={styles.trustPrimary}>
              <span className={styles.trustLabel}>CURRENT DEFAULT</span>
              <h3>Browser-local campaign work</h3>
              <p>
                Campaigns can be saved, reopened, copied, versioned, and exported in the current browser.
                Portable archives use explicit validation, conflict policy, and rollback controls.
              </p>
              <ul>
                {TRUST_POINTS.map((point) => (
                  <li key={point}><CheckIcon /> {point}</li>
                ))}
              </ul>
            </article>

            <div className={styles.trustSide}>
              <article>
                <span>MODEL CHOICE</span>
                <strong>Managed configuration, temporary BYOK, local, or custom</strong>
                <p>Advanced routes remain available without overwhelming the normal campaign path.</p>
              </article>
              <article>
                <span>PUBLISHING</span>
                <strong>Confirmation before success</strong>
                <p>Copy, open-platform, and export remain first-class when a verified connector is unavailable.</p>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.finalCta} aria-labelledby="final-cta-title">
          <div>
            <p className={styles.eyebrow}>Your product already has the raw material</p>
            <h2 id="final-cta-title">Turn it into a campaign you can still recognize as yours.</h2>
          </div>
          <button className={styles.primaryButton} type="button" onClick={onEnter}>
            Enter SignalFlow Studio <ArrowIcon />
          </button>
        </section>
      </main>

      <footer className={styles.footer}>
        <div>
          <strong>SignalFlow Studio</strong>
          <p>Review-first campaign creation for builders, founders, and focused teams.</p>
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
