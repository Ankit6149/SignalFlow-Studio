import { assertSafeRemoteUrl } from "./urlSafety.mjs";

const MAX_RESPONSE_CHARS = 1_000_000;
const MAX_CONTEXT_CHARS = 10000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const ALLOWED_CONTENT_TYPES = ["text/html", "text/plain", "application/xhtml+xml", "application/xml"];

export async function fetchUrlContent(urlStr) {
  if (!urlStr) return null;

  const result = { url: "", title: "", description: "", text: "", warnings: [] };

  try {
    const { response, finalUrl } = await fetchValidated(urlStr);
    result.url = finalUrl.toString();

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !ALLOWED_CONTENT_TYPES.some((type) => contentType.includes(type))) {
      throw new Error(`Unsupported response type: ${contentType.split(";")[0]}`);
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_RESPONSE_CHARS) {
      throw new Error("Response is larger than the allowed fetch limit.");
    }

    let html = await response.text();
    if (html.length > MAX_RESPONSE_CHARS) {
      result.warnings.push("Fetched content was truncated before parsing because it exceeded the fetch limit.");
      html = html.substring(0, MAX_RESPONSE_CHARS);
    }

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch?.[1]) result.title = cleanText(titleMatch[1]);

    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i) ||
      html.match(/<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i);
    if (descMatch?.[1]) result.description = cleanText(descMatch[1]);

    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    let bodyContent = bodyMatch?.[1] || html;
    bodyContent = bodyContent.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "");
    bodyContent = bodyContent.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "");
    bodyContent = bodyContent.replace(/<!--([\s\S]*?)-->/g, "");
    bodyContent = bodyContent.replace(/<\/p>|<\/div>|<\/h[1-6]>|<\/li>|<\/tr>/gi, "\n");

    let plainText = bodyContent.replace(/<[^>]*>/g, " ");
    plainText = decodeHtmlEntities(plainText)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");

    if (plainText.length > MAX_CONTEXT_CHARS) {
      plainText = `${plainText.substring(0, MAX_CONTEXT_CHARS)}\n\n... [Content truncated to fit context budget] ...`;
    }
    result.text = plainText;
  } catch (error) {
    result.url ||= String(urlStr || "").trim();
    result.warnings.push(`Failed to fetch URL content for ${result.url}: ${error.message}`);
  }

  return result;
}

async function fetchValidated(initialUrl) {
  let currentUrl = await assertSafeRemoteUrl(initialUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(currentUrl.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "SignalFlowStudio/1.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8",
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status < 300 || response.status >= 400) {
      return { response, finalUrl: currentUrl };
    }

    const location = response.headers.get("location");
    if (!location) throw new Error("Redirect response did not include a destination.");
    if (redirectCount === MAX_REDIRECTS) throw new Error("Too many redirects.");
    currentUrl = await assertSafeRemoteUrl(new URL(location, currentUrl));
  }

  throw new Error("Unable to resolve the requested URL.");
}

function cleanText(text) {
  return decodeHtmlEntities(String(text || "").replace(/\s+/g, " ").trim());
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
