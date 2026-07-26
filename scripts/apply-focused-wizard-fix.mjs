import fs from "node:fs";

const pagePath = "frontend/app/page.js";
const cssPath = "frontend/app/app-workspace.css";

let page = fs.readFileSync(pagePath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

function replaceRequired(pattern, replacement, label) {
  const next = page.replace(pattern, replacement);
  if (next === page) {
    throw new Error(`Could not apply page migration: ${label}`);
  }
  page = next;
}

replaceRequired(
  /const \[stage, setStage\] = useState\("compose"\);/,
  'const [stage, setStage] = useState("source");',
  "initial wizard stage",
);

page = page.replaceAll('setStage("compose")', 'setStage("source")');

replaceRequired(
  /  function navigateStudioFlow\(targetStage, elementId\) \{[\s\S]*?\n  \}\n\n  function toggleChannel/,
  `  function navigateStudioFlow(targetStage) {
    setStage(targetStage);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById("workspace-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function toggleChannel`,
  "wizard navigation",
);

replaceRequired(
  /              <h1>\n                \{stage === "compose"[\s\S]*?              <\/p>/,
  `              <h1>
                {stage === "source"
                  ? "What are we telling the world?"
                  : stage === "destinations"
                    ? "Where should this story travel?"
                    : "Shape every draft before it leaves."}
              </h1>
              <p>
                {stage === "source"
                  ? "Bring the facts, proof, links, repository, and files. Keep this first step focused on product truth."
                  : stage === "destinations"
                    ? "Choose only the formats you need, then select the model route that will shape them."
                    : "Edit the words, watch platform guidance, then publish or export deliberately."}
              </p>`,
  "stage-specific heading",
);

const flowStart = page.indexOf('          <nav className="studio-flow" aria-label="Campaign creation steps">');
const flowEndMarker = '\n          </nav>';
const flowEnd = page.indexOf(flowEndMarker, flowStart);
if (flowStart < 0 || flowEnd < 0) throw new Error("Could not locate studio flow navigation");
const newFlow = `          <nav className="studio-flow" aria-label="Campaign creation steps">
            <button
              type="button"
              className={stage === "source" ? "is-active" : sourceSignals > 0 ? "is-complete" : ""}
              onClick={() => navigateStudioFlow("source")}
              aria-current={stage === "source" ? "step" : undefined}
            >
              <span className="studio-flow__index">01</span>
              <span><strong>Source</strong><small>Bring the facts and proof</small></span>
            </button>
            <button
              type="button"
              className={stage === "destinations" ? "is-active" : stage === "review" ? "is-complete" : ""}
              onClick={() => navigateStudioFlow("destinations")}
              disabled={sourceSignals === 0}
              aria-current={stage === "destinations" ? "step" : undefined}
            >
              <span className="studio-flow__index">02</span>
              <span><strong>Destinations & model</strong><small>Choose formats and generation route</small></span>
            </button>
            <button
              type="button"
              className={stage === "review" ? "is-active" : ""}
              onClick={() => result && navigateStudioFlow("review")}
              disabled={!result}
              aria-current={stage === "review" ? "step" : undefined}
            >
              <span className="studio-flow__index">03</span>
              <span><strong>Review</strong><small>Shape and route every draft</small></span>
            </button>
          </nav>`;
page = page.slice(0, flowStart) + newFlow + page.slice(flowEnd + flowEndMarker.length);

replaceRequired(
  '<section className="panel composer-panel" id="campaign-source">',
  '<section className={`panel composer-panel ${stage !== "source" ? "is-step-hidden" : ""}`} id="campaign-source">',
  "source panel visibility",
);
replaceRequired(
  '<section className="panel output-panel" id="campaign-destinations">',
  '<section className={`panel output-panel ${stage === "source" ? "is-step-hidden" : ""}`} id="campaign-destinations">',
  "destination panel visibility",
);

const advancedPattern = /(\n              <button\n                className="advanced-toggle"[\s\S]*\n              \)\})\n(?=            <\/section>\n\n            <section className=\{`panel output-panel)/;
const advancedMatch = page.match(advancedPattern);
if (!advancedMatch) throw new Error("Could not move voice and model controls to step two");
const advancedBlock = advancedMatch[1];
page = page.replace(advancedPattern, "\n");

const readinessMarker = '              {stage === "compose" ? (';
if (!page.includes(readinessMarker)) throw new Error("Could not locate destination readiness block");
page = page.replace(
  readinessMarker,
  `${advancedBlock}\n\n              {stage === "destinations" ? (`,
);

const actionStart = page.indexOf('          <div className="studio-actionbar" id="campaign-command">');
const actionEndMarker = '\n        </main>';
const actionEnd = page.indexOf(actionEndMarker, actionStart);
if (actionStart < 0 || actionEnd < 0) throw new Error("Could not locate studio action bar");
const newActionBar = `          <div className="studio-actionbar" id="campaign-command">
            <div className="studio-actionbar__summary">
              <span>{sourceSignals} source signal{sourceSignals === 1 ? "" : "s"}</span>
              <i />
              <span>{channels.length} destinations</span>
              <i />
              <span>{provider.label}</span>
            </div>
            <div className="studio-actionbar__actions">
              {stage !== "source" && (
                <button
                  type="button"
                  className="button button--outline"
                  onClick={() => navigateStudioFlow(stage === "review" ? "destinations" : "source")}
                  disabled={busy}
                >
                  Back
                </button>
              )}
              {stage === "source" ? (
                <button
                  type="button"
                  className="button button--champagne button--premium"
                  onClick={() => navigateStudioFlow("destinations")}
                  disabled={sourceSignals === 0}
                >
                  Continue to destinations <ArrowIcon />
                </button>
              ) : (
                <button
                  type="button"
                  className="button button--champagne button--premium"
                  onClick={generateCampaign}
                  disabled={busy || !composeReady}
                >
                  {busy
                    ? "Building campaign…"
                    : stage === "review"
                      ? "Regenerate campaign"
                      : "Build campaign"}
                  {!busy && <SparkIcon />}
                </button>
              )}
            </div>
          </div>`;
page = page.slice(0, actionStart) + newActionBar + page.slice(actionEnd);

if (page.includes('stage === "compose"')) {
  throw new Error('Legacy compose-stage checks remain after wizard migration');
}

const cssMarker = "/* Focused three-step wizard */";
if (!css.includes(cssMarker)) {
  css += `

${cssMarker}
.app-shell .studio-page[data-stage="source"],
.app-shell .studio-page[data-stage="destinations"] {
  width: min(70rem, 92vw);
}

.app-shell .studio-heading,
.app-shell .studio-flow,
.app-shell .studio-grid,
.app-shell .studio-actionbar {
  width: 100%;
  max-width: 64rem;
  margin-right: auto;
  margin-left: auto;
}

.app-shell .studio-grid {
  border-bottom: 0.0625rem solid var(--app-line);
  border-radius: var(--app-radius);
}

.app-shell .studio-grid .is-step-hidden {
  display: none !important;
}

.app-shell .studio-grid:not(.studio-grid--review) .composer-panel,
.app-shell .studio-grid:not(.studio-grid--review) .output-panel {
  min-height: auto;
  padding: clamp(1.5rem, 3vw, 2.5rem);
}

.app-shell .studio-grid:not(.studio-grid--review) .output-panel {
  border-top: 0;
}

.app-shell .studio-flow button.is-complete {
  color: var(--app-ink);
}

.app-shell .studio-flow button.is-complete .studio-flow__index {
  border-color: #c9d8cc;
  background: var(--app-success-soft);
  color: var(--app-success);
}

.app-shell .studio-flow button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.app-shell .studio-actionbar {
  margin-top: 1rem;
  border-radius: var(--app-radius);
  box-shadow: 0 0.75rem 2rem rgba(24, 24, 20, 0.035);
}

.app-shell .studio-actionbar__summary,
.app-shell .studio-actionbar__actions {
  display: flex;
  align-items: center;
}

.app-shell .studio-actionbar__summary {
  flex-wrap: wrap;
  gap: 0.65rem;
}

.app-shell .studio-actionbar__actions {
  flex-shrink: 0;
  justify-content: flex-end;
  gap: 0.65rem;
}

.app-shell .studio-actionbar__actions .button--outline {
  background: var(--app-surface);
}

.app-shell .studio-page[data-stage="source"] .composer-panel {
  max-width: 64rem;
}

.app-shell .studio-page[data-stage="destinations"] .channel-groups {
  gap: 2rem;
}

.app-shell .studio-page[data-stage="destinations"] .advanced-toggle {
  margin-top: 2rem;
}

@media (max-width: 760px) {
  .app-shell .studio-page[data-stage="source"],
  .app-shell .studio-page[data-stage="destinations"] {
    width: min(100% - 1.25rem, 70rem);
  }

  .app-shell .studio-flow {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .app-shell .studio-flow button {
    min-height: 3.75rem;
    padding: 0.75rem 0;
  }

  .app-shell .studio-flow button::after {
    display: none;
  }

  .app-shell .source-grid,
  .app-shell .channel-picker {
    grid-template-columns: 1fr;
  }

  .app-shell .studio-actionbar {
    align-items: stretch;
    flex-direction: column;
  }

  .app-shell .studio-actionbar__actions,
  .app-shell .studio-actionbar__actions .button {
    width: 100%;
  }

  .app-shell .studio-actionbar__actions {
    flex-direction: column-reverse;
  }
}
`;
}

fs.writeFileSync(pagePath, page);
fs.writeFileSync(cssPath, css);
console.log("Applied focused Source → Destinations & model → Review wizard.");
