import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.SIGNALFLOW_AUDIT_URL || "http://127.0.0.1:3000";
const outputDir = path.resolve(process.cwd(), process.env.SIGNALFLOW_AUDIT_OUTPUT || "visual-audit-output");

const viewports = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "laptop-1024", width: 1024, height: 768 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
];

function generationResponse(channels) {
  const posts = Object.fromEntries(
    channels.map((channel) => [
      channel,
      `${channel.toUpperCase()} draft\n\nSignalFlow turns one verified product brief into an editable campaign while preserving review, recovery, export, and publishing boundaries. This deterministic browser-audit draft is intentionally long enough to expose layout and wrapping defects across desktop, tablet, mobile, and zoomed views.`,
    ]),
  );
  const generationStatus = Object.fromEntries(
    channels.map((channel) => [channel, { status: "generated" }]),
  );

  return {
    ok: true,
    providerUsed: "gemini",
    fallbackUsed: false,
    channels,
    package: {
      project: { name: "Rendered UI audit" },
      generation: { mode: "staged_agent" },
    },
    generation_status: generationStatus,
    posts,
    warnings: [],
  };
}

async function collectMetrics(page, viewport, surface) {
  return page.evaluate(({ viewport, surface }) => {
    const root = surface === "landing"
      ? document.querySelector("[id='top']")
      : document.querySelector(".app-shell");
    const heading = root?.querySelector("h1");
    const headingStyle = heading ? getComputedStyle(heading) : null;
    const visible = [...document.querySelectorAll("button, a, input, textarea, select, summary")]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      });
    const horizontallyClipped = visible
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          label: (element.getAttribute("aria-label") || element.textContent || element.getAttribute("placeholder") || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 90),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.left < -1 || item.right > window.innerWidth + 1);
    const tinyControls = visible
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          label: (element.getAttribute("aria-label") || element.textContent || "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 90),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          fontSize: parseFloat(getComputedStyle(element).fontSize),
        };
      })
      .filter((item) => item.fontSize < 11 || (item.tag === "button" && item.height < 36));

    return {
      surface,
      viewport,
      document: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      },
      root: root
        ? {
            width: Math.round(root.getBoundingClientRect().width),
            scrollWidth: root.scrollWidth,
            clientWidth: root.clientWidth,
          }
        : null,
      heading: heading && headingStyle
        ? {
            text: heading.textContent.replace(/\s+/g, " ").trim(),
            fontSize: parseFloat(headingStyle.fontSize),
            lineHeight: headingStyle.lineHeight,
            width: Math.round(heading.getBoundingClientRect().width),
            height: Math.round(heading.getBoundingClientRect().height),
          }
        : null,
      horizontallyClipped,
      tinyControls,
    };
  }, { viewport, surface });
}

async function capture(page, viewport, surface, metrics) {
  const filename = `${viewport.name}-${surface}.png`;
  await page.screenshot({
    path: path.join(outputDir, filename),
    fullPage: true,
    animations: "disabled",
  });
  metrics.push(await collectMetrics(page, viewport, surface));
}

async function prepareStudio(page) {
  await page.getByRole("button", { name: /Create a campaign|Open Studio/i }).first().click();
  await page.locator(".app-shell").waitFor({ state: "visible" });
  await page.locator(".studio-page[data-stage='source']").waitFor({ state: "visible" });
}

async function prepareDestinations(page) {
  await page.getByLabel("Campaign name").fill("Rendered responsive campaign");
  await page.getByLabel("What happened, and why should anyone care?").fill(
    "SignalFlow now has a real campaign architecture, source evidence, model routing, review states, recovery, exports, and confirmed publishing boundaries. The interface must remain readable and efficient across every supported viewport.",
  );
  await page.getByRole("button", { name: /Continue to destinations/i }).click();
  await page.locator(".studio-page[data-stage='destinations']").waitFor({ state: "visible" });
  await page.locator(".model-route-status").waitFor({ state: "visible" });
  await page.waitForFunction(() => !document.querySelector(".model-route-status")?.textContent?.includes("Checking"));
  const temporaryKey = page.getByLabel("Temporary API key").first();
  if (await temporaryKey.count()) {
    await temporaryKey.fill("visual-audit-temporary-key");
  }
}

async function prepareReview(page) {
  const buildButton = page.getByRole("button", { name: /^Build campaign/i });
  await buildButton.waitFor({ state: "visible" });
  await buildButton.click();
  await page.locator(".studio-page[data-stage='review']").waitFor({ state: "visible", timeout: 20_000 });
  await page.locator(".review-workspace").waitFor({ state: "visible" });
}

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const metrics = [];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();

    await page.route("**/api/launch_kit", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      const requestBody = route.request().postDataJSON();
      const channels = Array.isArray(requestBody?.channels) && requestBody.channels.length
        ? requestBody.channels
        : ["linkedin", "x"];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(generationResponse(channels)),
      });
    });

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Turn one product story/i }).waitFor({ state: "visible" });
    await capture(page, viewport, "landing", metrics);

    await prepareStudio(page);
    await capture(page, viewport, "source", metrics);

    await prepareDestinations(page);
    await capture(page, viewport, "destinations", metrics);

    await prepareReview(page);
    await capture(page, viewport, "review", metrics);

    await context.close();
  }

  const zoomContext = await browser.newContext({
    viewport: { width: 720, height: 450 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const zoomPage = await zoomContext.newPage();
  await zoomPage.goto(baseUrl, { waitUntil: "networkidle" });
  await zoomPage.getByRole("heading", { name: /Turn one product story/i }).waitFor({ state: "visible" });
  await capture(zoomPage, { name: "desktop-200-percent", width: 720, height: 450, equivalent: "1440x900 at 200%" }, "landing", metrics);
  await prepareStudio(zoomPage);
  await capture(zoomPage, { name: "desktop-200-percent", width: 720, height: 450, equivalent: "1440x900 at 200%" }, "source", metrics);
  await zoomContext.close();
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(outputDir, "metrics.json"),
  `${JSON.stringify(metrics, null, 2)}\n`,
  "utf8",
);

const failures = metrics.flatMap((entry) => {
  const issues = [];
  if (entry.document.horizontalOverflow) issues.push("document horizontal overflow");
  if (entry.horizontallyClipped.length) issues.push(`${entry.horizontallyClipped.length} horizontally clipped controls`);
  return issues.map((issue) => `${entry.viewport.name}/${entry.surface}: ${issue}`);
});

if (failures.length) {
  console.error("Rendered layout failures:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
}
