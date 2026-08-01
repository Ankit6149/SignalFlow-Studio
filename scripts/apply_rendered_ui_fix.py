from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LANDING = ROOT / "frontend" / "components" / "LandingPage.module.css"
WORKSPACE = ROOT / "frontend" / "app" / "app-workspace.css"
PRODUCT = ROOT / "frontend" / "app" / "studio-product.css"
TEST = ROOT / "frontend" / "tests" / "renderedResponsiveContract.test.mjs"
WORKFLOW = ROOT / ".github" / "workflows" / "ci.yml"
SCRIPT = Path(__file__)

FINAL_WORKFLOW = '''name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  mcp-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "22"
      - name: Run MCP protocol and tool tests
        working-directory: mcp
        run: npm test

  python-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.10"
      - name: Install Python dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
          pip install pytest
      - name: Run Python tests
        run: pytest -q

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - name: Install frontend dependencies
        working-directory: frontend
        run: npm ci
      - name: Run frontend regression tests
        working-directory: frontend
        run: npm test
      - name: Audit production dependencies
        working-directory: frontend
        run: npm audit --omit=dev --audit-level=high
      - name: Build frontend
        working-directory: frontend
        run: npm run build

  visual-audit:
    if: github.head_ref == 'fix/135-137-rendered-responsive-ui'
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - name: Install frontend and browser audit dependencies
        working-directory: frontend
        run: |
          npm ci
          npm install --no-save @playwright/test@1.54.2
          npx playwright install --with-deps chromium
      - name: Build the production frontend
        working-directory: frontend
        run: npm run build
      - name: Start the production frontend
        working-directory: frontend
        run: |
          npm run start -- -p 3000 > /tmp/signalflow-visual-audit-server.log 2>&1 &
          echo $! > /tmp/signalflow-visual-audit-server.pid
          for attempt in {1..60}; do
            if curl --fail --silent http://127.0.0.1:3000/ > /dev/null; then
              exit 0
            fi
            sleep 1
          done
          cat /tmp/signalflow-visual-audit-server.log
          exit 1
      - name: Capture and assert rendered Landing and Studio layouts
        working-directory: frontend
        run: node scripts/visual-audit.mjs
      - name: Upload rendered audit evidence
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: signalflow-rendered-responsive-audit
          path: frontend/visual-audit-output
          if-no-files-found: error
          retention-days: 7
'''

TEST_CONTENT = '''import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(here, "..");
const read = (relativePath) => fs.readFileSync(path.join(frontend, relativePath), "utf8");

const page = read("app/page.js");
const landing = read("components/LandingPage.module.css");
const workspace = read("app/app-workspace.css");
const product = read("app/studio-product.css");

test("inactive Studio stages are removed from layout and Review omits model setup", () => {
  assert.match(workspace, /\.app-shell \.is-step-hidden\s*\{\s*display:\s*none !important;/s);
  assert.match(workspace, /\.studio-grid--review \.model-route-panel/);
  assert.match(page, /stage === "source" \? "is-step-hidden"/);
  assert.match(page, /stage === "destinations" \? "is-step-hidden"/);
});

test("landing typography stays bounded at desktop, tablet, mobile, and zoom widths", () => {
  assert.match(landing, /font-size:\s*clamp\(3rem, 4\.7vw, 5rem\)/);
  assert.match(landing, /font-size:\s*clamp\(2\.6rem, 7vw, 3\.4rem\)/);
  assert.match(landing, /font-size:\s*clamp\(2\.2rem, 3\.8vw, 3\.75rem\)/);
  assert.doesNotMatch(landing, /font-size:\s*clamp\(3\.8rem, 6\.2vw, 6\.7rem\)/);
  assert.doesNotMatch(landing, /font-size:\s*clamp\(3\.2rem, 13vw, 5rem\)/);
});

test("responsive navigation and Review channels do not depend on hidden horizontal controls", () => {
  assert.match(workspace, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(workspace, /\.app-shell \.review-tabs\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s);
  assert.match(workspace, /@media \(max-width: 36rem\)[\s\S]*\.app-shell \.review-tabs\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(workspace, /\.review-tabs button\s*\{[^}]*min-width:\s*9\.5rem/s);
});

test("editing surfaces are responsive without changing the existing logo owner", () => {
  assert.match(product, /min-height:\s*clamp\(17rem, 32vh, 23rem\)/);
  assert.match(workspace, /min-height:\s*clamp\(20rem, 42vh, 30rem\)/);
  assert.match(page, /function BrandMark\(\{ compact = false, dark = false \}\)/);
  assert.match(page, /<span className="brand-mark__glyph" aria-hidden="true">/);
});
'''


def replace_exact(source: str, old: str, new: str, label: str, expected: int = 1) -> str:
    count = source.count(old)
    if count != expected:
        raise RuntimeError(f"Expected {expected} occurrence(s) of {label}; found {count}")
    return source.replace(old, new)


def patch_landing() -> None:
    source = LANDING.read_text(encoding="utf-8")
    replacements = [
        ("  min-height: 42rem;", "  min-height: 36rem;", "landing hero height"),
        ("  padding: clamp(4.5rem, 8vw, 7rem) 0 clamp(4rem, 7vw, 6.5rem);", "  padding: clamp(3.25rem, 5.5vw, 5rem) 0 clamp(3.25rem, 5vw, 4.75rem);", "landing hero padding"),
        ("  grid-template-columns: minmax(0, 0.92fr) minmax(30rem, 1.08fr);", "  grid-template-columns: minmax(0, 0.9fr) minmax(27rem, 1.1fr);", "landing hero columns"),
        ("  gap: clamp(3rem, 6vw, 6.5rem);", "  gap: clamp(2.5rem, 4.5vw, 4.75rem);", "landing hero gap"),
        ("  max-width: 10.5ch;", "  max-width: 12ch;", "landing headline measure"),
        ("  font-size: clamp(3.8rem, 6.2vw, 6.7rem);", "  font-size: clamp(3rem, 4.7vw, 5rem);", "landing desktop headline"),
        ("  line-height: 0.97;", "  line-height: 1;", "landing headline line height"),
        ("  font-size: clamp(1rem, 1.3vw, 1.12rem);", "  font-size: clamp(0.98rem, 1.1vw, 1.06rem);", "landing lead size"),
        ("  line-height: 1.75;", "  line-height: 1.68;", "first landing lead line height"),
        ("  min-height: 35rem;", "  min-height: 30rem;", "preview scene height"),
        ("  min-height: 6.25rem;", "  min-height: 5.25rem;", "proof row height"),
        ("  padding: clamp(5rem, 9vw, 8rem) max(1.5rem, calc((100vw - 88rem) / 2));", "  padding: clamp(3.75rem, 6vw, 5.75rem) max(1.5rem, calc((100vw - 88rem) / 2));", "landing section spacing", 4),
        ("  padding: clamp(2rem, 5vw, 4rem);", "  padding: clamp(1.75rem, 3.5vw, 3rem);", "workflow panel padding"),
        ("  font-size: clamp(2.8rem, 5vw, 5rem);", "  font-size: clamp(2.2rem, 3.8vw, 3.75rem);", "landing section heading"),
        ("  margin-top: 3.3rem;", "  margin-top: 2.4rem;", "landing section grid spacing", 2),
        ("  min-height: 21rem;", "  min-height: 17.5rem;", "workflow card height"),
        ("  margin: 3.1rem 0 0.9rem;", "  margin: 2.2rem 0 0.9rem;", "workflow card heading spacing"),
        ("  margin-top: 3.4rem;", "  margin-top: 2.5rem;", "trust grid spacing"),
        ("  font-size: 0.68rem;", "  font-size: 0.75rem;", "footer link size"),
        ("    min-height: 32rem;", "    min-height: 27rem;", "tablet preview height"),
        ("    padding-top: 3.8rem;", "    padding-top: 2.8rem;", "tablet hero top padding"),
        ("    padding-bottom: 4.5rem;", "    padding-bottom: 3.5rem;", "tablet hero bottom padding"),
        ("    font-size: clamp(3.2rem, 13vw, 5rem);", "    font-size: clamp(2.6rem, 7vw, 3.4rem);", "tablet and mobile headline"),
        ("    padding: 1.8rem 0 3.5rem;", "    padding: 1rem 0 2.5rem;", "tablet preview spacing"),
        ("    font-size: clamp(2.5rem, 13vw, 3.7rem);", "    font-size: clamp(1.95rem, 8vw, 2.65rem);", "mobile section heading"),
    ]
    for item in replacements:
        old, new, label, *expected = item
        source = replace_exact(source, old, new, label, expected[0] if expected else 1)
    LANDING.write_text(source, encoding="utf-8")


def patch_workspace() -> None:
    source = WORKSPACE.read_text(encoding="utf-8")
    source = replace_exact(
        source,
        "/* Review */\n.app-shell .studio-grid--review {",
        "/* Stage visibility is structural: inactive stages must not consume layout or remain focusable. */\n.app-shell .is-step-hidden {\n  display: none !important;\n}\n\n/* Review */\n.app-shell .studio-grid--review {",
        "stage visibility owner",
    )
    source = replace_exact(
        source,
        ".app-shell .studio-grid--review .channel-groups,\n.app-shell .studio-grid--review > .output-panel > .panel-kicker {",
        ".app-shell .studio-grid--review .channel-groups,\n.app-shell .studio-grid--review .model-route-panel,\n.app-shell .studio-grid--review > .output-panel > .panel-kicker {",
        "review-only surface ownership",
    )
    source = replace_exact(
        source,
        "  min-height: clamp(32rem, 56vh, 48rem);",
        "  min-height: clamp(20rem, 42vh, 30rem);",
        "review editor height",
    )
    old_tabs = '''  .app-shell .review-tabs {
    min-width: 0;
    flex-direction: row;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    padding-bottom: 0.5rem;
    scroll-snap-type: inline proximity;
    scrollbar-width: none;
  }

  .app-shell .review-tabs::-webkit-scrollbar {
    display: none;
  }

  .app-shell .review-tabs button {
    width: auto;
    min-width: 9.5rem;
    flex: 0 0 auto;
    border-left: 0;
    border-bottom: 0.15rem solid transparent;
    scroll-snap-align: start;
  }

  .app-shell .review-tabs button.is-active {
    border-bottom-color: var(--app-accent);
  }
'''
    new_tabs = '''  .app-shell .review-tabs {
    min-width: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.45rem;
    overflow: visible;
  }

  .app-shell .review-tabs button {
    width: 100%;
    min-width: 0;
    min-height: 3.1rem;
    border: 0.0625rem solid var(--app-line);
    border-left: 0.15rem solid transparent;
    border-radius: 0.45rem;
  }

  .app-shell .review-tabs button.is-active {
    border-color: var(--app-accent);
    border-left-color: var(--app-accent);
  }
'''
    source = replace_exact(source, old_tabs, new_tabs, "tablet Review channel grid")
    old_nav = '''  .app-shell .app-nav {
    grid-column: 1 / -1;
    width: 100%;
    justify-content: flex-start;
    gap: 0.2rem;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scroll-snap-type: inline proximity;
    scrollbar-width: none;
  }

  .app-shell .app-nav::-webkit-scrollbar {
    display: none;
  }

  .app-shell .app-nav button {
    flex: 0 0 auto;
    scroll-snap-align: start;
  }
'''
    new_nav = '''  .app-shell .app-nav {
    grid-column: 1 / -1;
    width: 100%;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.25rem;
    overflow: visible;
  }

  .app-shell .app-nav button {
    width: 100%;
    min-width: 0;
    padding: 0.5rem 0.3rem;
    justify-content: center;
    font-size: 0.7rem;
    white-space: nowrap;
  }
'''
    source = replace_exact(source, old_nav, new_nav, "mobile app navigation grid")
    source = replace_exact(
        source,
        '''  .app-shell .review-inspector dl,
  .app-shell .review-actions,
  .app-shell .export-row {
''',
        '''  .app-shell .review-tabs {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .app-shell .review-inspector dl,
  .app-shell .review-actions,
  .app-shell .export-row {
''',
        "mobile Review grid",
    )
    source = replace_exact(
        source,
        "    min-height: 24rem;",
        "    min-height: 18rem;",
        "mobile editor height",
    )
    source = replace_exact(
        source,
        "/* Desktop expansion only when the viewport truly has room. */",
        '''.app-shell .panel-kicker--with-actions button {
  min-height: 2.1rem;
  padding: 0.35rem 0.55rem;
  border-radius: 0.35rem;
}

.app-shell .toast button {
  width: 2.25rem;
  height: 2.25rem;
  flex: 0 0 2.25rem;
  display: grid;
  place-items: center;
}

/* Desktop expansion only when the viewport truly has room. */''',
        "compact control sizing",
    )
    WORKSPACE.write_text(source, encoding="utf-8")


def patch_product() -> None:
    source = PRODUCT.read_text(encoding="utf-8")
    source = replace_exact(
        source,
        "  grid-template-rows: auto minmax(20rem, 1fr) auto;",
        "  grid-template-rows: auto minmax(17rem, 1fr) auto;",
        "source brief grid height",
    )
    source = replace_exact(
        source,
        "  min-height: clamp(20rem, 38vh, 29rem);",
        "  min-height: clamp(17rem, 32vh, 23rem);",
        "source brief textarea height",
    )
    source = replace_exact(
        source,
        '''@media (max-width: 44rem) {
  .app-shell .studio-page[data-stage="source"] .source-grid,
''',
        '''@media (max-width: 44rem) {
  .app-shell .studio-page[data-stage="source"] .field--large textarea {
    min-height: 14rem;
  }

  .app-shell .studio-page[data-stage="source"] .source-grid,
''',
        "mobile source textarea sizing",
    )
    PRODUCT.write_text(source, encoding="utf-8")


def main() -> None:
    patch_landing()
    patch_workspace()
    patch_product()
    TEST.write_text(TEST_CONTENT, encoding="utf-8")
    WORKFLOW.write_text(FINAL_WORKFLOW, encoding="utf-8")
    SCRIPT.unlink()


if __name__ == "__main__":
    main()
