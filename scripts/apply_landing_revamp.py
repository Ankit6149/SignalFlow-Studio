from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "frontend" / "app" / "page.js"
GLOBALS = ROOT / "frontend" / "app" / "globals.css"
WORKFLOW = ROOT / ".github" / "workflows" / "ci.yml"
SCRIPT = Path(__file__)

ORIGINAL_CI = '''name: CI

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
'''

BRAND_MARK = '''function BrandMark({ compact = false, dark = false }) {
  return (
    <span
      className={`brand-mark ${compact ? "brand-mark--compact" : ""} ${dark ? "brand-mark--dark" : ""}`}
      aria-label="SignalFlow Studio"
    >
      <span className="brand-mark__glyph" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="brand-mark__copy">
        <strong>SignalFlow</strong>
        {!compact && <small>STUDIO</small>}
      </span>
    </span>
  );
}
'''

TABLET_LANDING_RULES = '''  .landing-hero { grid-template-columns: 1fr; padding-top: 70px; }
  .landing-hero__visual { width: min(760px, 100%); margin: 0 auto; }
'''

MOBILE_LANDING_RULES = '''  .landing-nav, .landing-hero { width: min(100% - 34px, 1460px); }
  .landing-nav { height: 76px; }
  .landing-nav__actions > a { display: none; }
  .landing-hero { padding: 52px 0 66px; gap: 18px; }
  .landing-hero__copy h1 { font-size: clamp(48px, 14vw, 72px); }
  .landing-hero__lede { font-size: 15px; }
  .landing-hero__actions { align-items: flex-start; flex-direction: column; }
  .landing-proof { gap: 10px; }
  .landing-proof span { font-size: 10px; }
  .landing-hero__visual { height: 470px; }
  .visual-photo { width: 66%; height: 58%; }
  .floating-card--main { width: 76%; min-height: 260px; padding: 18px; }
  .floating-card__headline { margin-top: 34px; font-size: 25px; }
  .floating-card--metric { right: 1%; }
  .landing-strip { overflow-x: auto; justify-content: flex-start; }
  .landing-strip span { flex: 0 0 auto; }
  .landing-editorial { padding: 88px 22px; }
  .editorial-grid { grid-template-columns: 1fr; }
  .landing-cta { padding: 76px 22px; align-items: flex-start; flex-direction: column; }
'''


def replace_once(value: str, old: str, new: str, label: str) -> str:
    count = value.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one {label}; found {count}")
    return value.replace(old, new, 1)


def remove_between(value: str, start: str, end: str, label: str) -> str:
    start_index = value.find(start)
    end_index = value.find(end, start_index + len(start))
    if start_index < 0 or end_index < 0:
        raise RuntimeError(f"Could not locate guarded {label} range")
    return value[:start_index] + value[end_index:]


def patch_page() -> None:
    source = PAGE.read_text(encoding="utf-8")

    if BRAND_MARK not in source:
        raise RuntimeError("Existing BrandMark changed; refusing to migrate the landing route")

    source = replace_once(
        source,
        'import PlatformIcon from "../components/PlatformIcon";\n',
        'import PlatformIcon from "../components/PlatformIcon";\nimport LandingPage from "../components/LandingPage";\n',
        "LandingPage import anchor",
    )

    source = remove_between(
        source,
        "const FAQS = [\n",
        "function safeJsonParse(value, fallback) {",
        "obsolete landing FAQ data",
    )

    source = remove_between(
        source,
        "function LandingPage({ onEnter }) {\n",
        "export default function Home() {",
        "inline landing component",
    )

    source = replace_once(
        source,
        'if (!entered) return <LandingPage onEnter={enterStudio} />;',
        'if (!entered) return <LandingPage onEnter={enterStudio} brand={<BrandMark />} />;',
        "landing render",
    )

    if BRAND_MARK not in source:
        raise RuntimeError("BrandMark was modified during migration")
    if "function LandingPage({ onEnter })" in source:
        raise RuntimeError("Inline landing component remains after migration")
    if source.count('import LandingPage from "../components/LandingPage";') != 1:
        raise RuntimeError("LandingPage import is not canonical")

    PAGE.write_text(source, encoding="utf-8")


def patch_globals() -> None:
    source = GLOBALS.read_text(encoding="utf-8")
    source = remove_between(
        source,
        ".landing-shell {",
        ".app-shell {",
        "legacy global landing styles",
    )
    source = replace_once(
        source,
        TABLET_LANDING_RULES,
        "",
        "tablet landing media rules",
    )
    source = replace_once(
        source,
        MOBILE_LANDING_RULES,
        "",
        "mobile landing media rules",
    )
    retired_tokens = (
        ".landing-shell",
        ".landing-nav",
        ".landing-hero",
        ".landing-proof",
        ".landing-strip",
        ".landing-editorial",
        ".landing-cta",
        ".visual-photo",
        ".floating-card",
        ".editorial-grid",
    )
    remaining = [token for token in retired_tokens if token in source]
    if remaining:
        raise RuntimeError(f"Legacy landing selectors remain in globals.css: {remaining}")
    GLOBALS.write_text(source, encoding="utf-8")


def main() -> None:
    patch_page()
    patch_globals()
    WORKFLOW.write_text(ORIGINAL_CI, encoding="utf-8")
    SCRIPT.unlink()


if __name__ == "__main__":
    main()
