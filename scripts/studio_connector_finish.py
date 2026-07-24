from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    content = target.read_text(encoding="utf-8")
    if old not in content:
        raise RuntimeError(f"Expected snippet not found in {path}: {old[:160]!r}")
    target.write_text(content.replace(old, new, 1), encoding="utf-8")


def append(path: str, content: str) -> None:
    target = ROOT / path
    current = target.read_text(encoding="utf-8")
    if content.strip() not in current:
        target.write_text(current.rstrip() + "\n\n" + content.strip() + "\n", encoding="utf-8")


# Studio state and publishing metadata.
replace_once(
    "frontend/app/page.js",
    '''  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [ownerKey, setOwnerKey] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);''',
    '''  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [ownerKey, setOwnerKey] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [publishOptions, setPublishOptions] = useState({
    reddit: { subreddit: "", title: "" },
  });''',
)

replace_once(
    "frontend/app/page.js",
    '''  const currentConnection = connections[activeChannel] || null;
  const canPublishCurrent = Boolean(
    currentConnection?.connected && !currentConnection?.expired && !currentConnection?.manualOnly,
  );
  const characterPercent = activeMeta.limit
    ? Math.min(100, Math.round((currentPost.length / activeMeta.limit) * 100))
    : 0;
  const isOverLimit = Boolean(activeMeta.limit && currentPost.length > activeMeta.limit);
  const sourceSignals = [''',
    '''  const currentConnection = connections[activeChannel] || null;
  const canPublishCurrent = Boolean(
    currentConnection?.connected && !currentConnection?.expired && !currentConnection?.manualOnly,
  );
  const xThreadParts = activeChannel === "x"
    ? currentPost.split(/\n\n+/).map((part) => part.trim()).filter(Boolean)
    : [];
  const xThreadMode = activeChannel === "x" && currentPost.length > activeMeta.limit && xThreadParts.length > 1;
  const xLongestPart = xThreadParts.reduce((longest, part) => Math.max(longest, part.length), 0);
  const characterValue = xThreadMode ? xLongestPart : currentPost.length;
  const characterPercent = activeMeta.limit
    ? Math.min(100, Math.round((characterValue / activeMeta.limit) * 100))
    : 0;
  const isOverLimit = Boolean(
    activeMeta.limit && (
      xThreadMode
        ? xThreadParts.length > 25 || xThreadParts.some((part) => part.length > activeMeta.limit)
        : currentPost.length > activeMeta.limit
    )
  );
  const sourceSignals = [''',
)

replace_once(
    "frontend/app/page.js",
    '''  function updateForm(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function toggleChannel(channelId) {''',
    '''  function updateForm(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function updatePublishOption(platform, key, value) {
    setPublishOptions((previous) => ({
      ...previous,
      [platform]: { ...(previous[platform] || {}), [key]: value },
    }));
  }

  function navigateStudioFlow(targetStage, elementId) {
    if (targetStage === "compose") setStage("compose");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById(elementId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function toggleChannel(channelId) {''',
)

replace_once(
    "frontend/app/page.js",
    '''      result,
      brief: { ...form, apiKey: "" },
    };''',
    '''      result,
      brief: { ...form, apiKey: "" },
      publishOptions,
    };''',
)

replace_once(
    "frontend/app/page.js",
    '''    setResult(item.result || { markdown: item.markdown, warnings: item.warnings || [] });
    setActiveChannel((item.channels || ["linkedin"])[0]);''',
    '''    setResult(item.result || { markdown: item.markdown, warnings: item.warnings || [] });
    setPublishOptions(item.publishOptions || { reddit: { subreddit: "", title: "" } });
    setActiveChannel((item.channels || ["linkedin"])[0]);''',
)

replace_once(
    "frontend/app/page.js",
    '''      JSON.stringify({ campaign: form.projectName, channels, posts, result }, null, 2),''',
    '''      JSON.stringify({ campaign: form.projectName, channels, posts, publishOptions, result }, null, 2),''',
)

# Honest publishing validation and per-platform options.
replace_once(
    "frontend/app/page.js",
    '''    if (isOverLimit) {
      setMessage({
        type: "error",
        text: `This ${activeMeta.label} draft is over the ${activeMeta.limit.toLocaleString()} character guide.`,
      });
      return;
    }

    if (!window.confirm(`Publish this approved draft to ${activeMeta.label}?`)) return;

    setBusy(true);''',
    '''    if (isOverLimit) {
      setMessage({
        type: "error",
        text: activeChannel === "x" && xThreadMode
          ? "Every X thread post must stay within 280 characters and a thread may contain at most 25 posts."
          : `This ${activeMeta.label} draft is over the ${activeMeta.limit.toLocaleString()} character guide.`,
      });
      return;
    }

    let options = {};
    if (activeChannel === "reddit") {
      const subreddit = String(publishOptions.reddit?.subreddit || "")
        .trim()
        .replace(/^r\//i, "");
      const title = String(publishOptions.reddit?.title || form.projectName || "").trim();
      if (!/^[A-Za-z0-9_]{2,21}$/.test(subreddit)) {
        setMessage({ type: "error", text: "Enter a valid subreddit name before publishing. Do not include spaces or the r/ prefix." });
        return;
      }
      if (!title) {
        setMessage({ type: "error", text: "Add a Reddit post title before publishing." });
        return;
      }
      options = { subreddit, title };
    }

    if (!window.confirm(`Publish this approved draft to ${activeMeta.label}?`)) return;

    setBusy(true);''',
)

replace_once(
    "frontend/app/page.js",
    '''          content: currentPost,
          projectName: form.projectName,
        }),''',
    '''          content: currentPost,
          projectName: form.projectName,
          options,
        }),''',
)

# Step navigation should work from Review as well.
replace_once(
    "frontend/app/page.js",
    '''              onClick={() => document.getElementById("campaign-source")?.scrollIntoView({ behavior: "smooth", block: "start" })}''',
    '''              onClick={() => navigateStudioFlow("compose", "campaign-source")}''',
)
replace_once(
    "frontend/app/page.js",
    '''              onClick={() => document.getElementById("campaign-destinations")?.scrollIntoView({ behavior: "smooth", block: "start" })}''',
    '''              onClick={() => navigateStudioFlow("compose", "campaign-destinations")}''',
)

# X thread-aware character feedback.
replace_once(
    "frontend/app/page.js",
    '''                      <span className={isOverLimit ? "is-over-limit" : ""}>
                        {currentPost.length.toLocaleString()}
                        {activeMeta.limit ? ` / ${activeMeta.limit.toLocaleString()}` : ""} characters
                      </span>''',
    '''                      <span className={isOverLimit ? "is-over-limit" : ""}>
                        {xThreadMode
                          ? `${xThreadParts.length} posts · longest ${xLongestPart.toLocaleString()} / ${activeMeta.limit.toLocaleString()} characters`
                          : `${currentPost.length.toLocaleString()}${activeMeta.limit ? ` / ${activeMeta.limit.toLocaleString()}` : ""} characters`}
                      </span>''',
)

replace_once(
    "frontend/app/page.js",
    '''                      <div><dt>Length</dt><dd>{activeMeta.limit ? `${currentPost.length.toLocaleString()} of ${activeMeta.limit.toLocaleString()} characters` : `${currentPost.length.toLocaleString()} characters; no fixed guide`}</dd></div>
                      <div><dt>Campaign context</dt><dd>{sourceSignals} source signal{sourceSignals === 1 ? "" : "s"}, {files.length} attached file{files.length === 1 ? "" : "s"}</dd></div>
                    </dl>
                  </aside>''',
    '''                      <div><dt>Length</dt><dd>{xThreadMode ? `${xThreadParts.length} posts; longest is ${xLongestPart} of ${activeMeta.limit} characters` : activeMeta.limit ? `${currentPost.length.toLocaleString()} of ${activeMeta.limit.toLocaleString()} characters` : `${currentPost.length.toLocaleString()} characters; no fixed guide`}</dd></div>
                      <div><dt>Campaign context</dt><dd>{sourceSignals} source signal{sourceSignals === 1 ? "" : "s"}, {files.length} attached file{files.length === 1 ? "" : "s"}</dd></div>
                    </dl>
                    {activeChannel === "reddit" && (
                      <div className="review-publish-fields">
                        <label>
                          <span>Subreddit</span>
                          <input
                            value={publishOptions.reddit?.subreddit || ""}
                            onChange={(event) => updatePublishOption("reddit", "subreddit", event.target.value)}
                            placeholder="e.g. SideProject"
                          />
                        </label>
                        <label>
                          <span>Post title</span>
                          <input
                            value={publishOptions.reddit?.title || ""}
                            onChange={(event) => updatePublishOption("reddit", "title", event.target.value)}
                            placeholder={form.projectName || "A clear, factual title"}
                          />
                        </label>
                        <small>Required for direct Reddit publishing. Community rules still apply.</small>
                      </div>
                    )}
                  </aside>''',
)

replace_once(
    "frontend/app/page.js",
    '''              <span>{connectedOfficialCount}/{selectedDirectCount} selected connectors live</span>''',
    '''              <span>{selectedDirectCount ? `${connectedOfficialCount}/${selectedDirectCount} selected connectors live` : "manual routes selected"}</span>''',
)

# Readiness must not guess before an authenticated inspection.
replace_once(
    "frontend/app/page.js",
    '''                const status = connections[platformId] || {};
                const ready = Boolean(status.configured && status.connected && !status.expired);
                return (
                  <article key={platformId} className="connector-readiness__card">''',
    '''                const status = connections[platformId] || {};
                const inspected = Boolean(accessToken && Object.keys(connections).length > 0);
                const ready = Boolean(inspected && status.configured && status.connected && !status.expired);
                const readinessLabel = connectionsLoading
                  ? "Checking"
                  : !inspected
                    ? "Unlock to inspect"
                    : ready
                      ? "Authorized"
                      : status.configured
                        ? "Needs authorization"
                        : "Needs credentials";
                return (
                  <article key={platformId} className="connector-readiness__card">''',
)
replace_once(
    "frontend/app/page.js",
    '''                      <span className={`readiness-state ${ready ? "is-ready" : ""}`}>{ready ? "Authorized" : status.configured ? "Needs authorization" : "Needs credentials"}</span>''',
    '''                      <span className={`readiness-state ${ready ? "is-ready" : ""}`}>{readinessLabel}</span>''',
)
replace_once(
    "frontend/app/page.js",
    '''                      <li>Credentials: {status.configured ? "configured" : "missing in deployment"}</li>
                      <li>Authorization: {status.expired ? "expired" : status.connected ? "active" : "not completed"}</li>
                      <li>Refresh: {status.hasRefreshToken ? "available" : "not yet verified"}</li>''',
    '''                      <li>Credentials: {!inspected ? "unlock and refresh to inspect" : status.configured ? "configured" : "missing in deployment"}</li>
                      <li>Authorization: {!inspected ? "not inspected" : status.expired ? "expired" : status.connected ? "active" : "not completed"}</li>
                      <li>Refresh: {!inspected ? "not inspected" : status.hasRefreshToken ? "available" : "not yet verified"}</li>''',
)

# Server-side connector validation: never truncate or default a live post silently.
replace_once(
    "frontend/lib/social/socialProviders.js",
    '''  if (parts.length === 1 || content.length <= platform.postMaxLength) {
    const response = await fetch(platform.postEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${valid.token}`,
      },
      body: JSON.stringify({ text: content.substring(0, platform.postMaxLength) }),
    });''',
    '''  if (content.length <= platform.postMaxLength) {
    const response = await fetch(platform.postEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${valid.token}`,
      },
      body: JSON.stringify({ text: content }),
    });''',
)

replace_once(
    "frontend/lib/social/socialProviders.js",
    '''  let previousPostId = null;
  let firstPostId = null;
  const threadParts = parts.slice(0, platform.threadMaxLength);

  for (let index = 0; index < threadParts.length; index += 1) {
    const postBody = { text: threadParts[index].substring(0, platform.postMaxLength) };''',
    '''  if (parts.length < 2) {
    throw new Error("This X draft is longer than 280 characters. Separate thread posts with a blank line before publishing.");
  }
  if (parts.length > platform.threadMaxLength) {
    throw new Error(`X threads are limited to ${platform.threadMaxLength} posts in SignalFlow.`);
  }
  const oversizedPart = parts.findIndex((part) => part.length > platform.postMaxLength);
  if (oversizedPart >= 0) {
    throw new Error(`X thread post ${oversizedPart + 1} is longer than ${platform.postMaxLength} characters.`);
  }

  let previousPostId = null;
  let firstPostId = null;
  const threadParts = parts;

  for (let index = 0; index < threadParts.length; index += 1) {
    const postBody = { text: threadParts[index] };''',
)

replace_once(
    "frontend/lib/social/socialProviders.js",
    '''  const valid = await ensureValidToken("reddit", tokenSession);
  const subreddit = options.subreddit || "test";
  const title = options.title || options.projectName || "New Post";

  const response = await fetch(platform.postEndpoint, {''',
    '''  const valid = await ensureValidToken("reddit", tokenSession);
  const subreddit = String(options.subreddit || "").trim().replace(/^r\//i, "");
  const title = String(options.title || options.projectName || "").trim();
  const userAgent = String(process.env.REDDIT_USER_AGENT || "").trim();

  if (!/^[A-Za-z0-9_]{2,21}$/.test(subreddit)) {
    throw new Error("A valid subreddit name is required for Reddit publishing.");
  }
  if (!title) throw new Error("A Reddit post title is required.");
  if (title.length > 300) throw new Error("Reddit post titles must be 300 characters or fewer.");
  if (content.length > platform.postMaxLength) {
    throw new Error(`Reddit post body exceeds ${platform.postMaxLength.toLocaleString()} characters.`);
  }
  if (!userAgent) {
    throw new Error("REDDIT_USER_AGENT must be configured with an identifiable app and Reddit username before publishing.");
  }

  const response = await fetch(platform.postEndpoint, {''',
)
replace_once(
    "frontend/lib/social/socialProviders.js",
    '''      "User-Agent": "SignalFlowStudio/1.0",''',
    '''      "User-Agent": userAgent,''',
)
replace_once(
    "frontend/lib/social/socialProviders.js",
    '''      title: title.substring(0, 300),
      text: content.substring(0, platform.postMaxLength),''',
    '''      title,
      text: content,''',
)

# Reddit configuration now includes current approval and identification requirements.
replace_once(
    "frontend/lib/social/socialConfig.js",
    '''    secretEnvKey: "REDDIT_CLIENT_SECRET",
    grantType: "authorization_code",''',
    '''    secretEnvKey: "REDDIT_CLIENT_SECRET",
    requiredEnvKeys: ["REDDIT_USER_AGENT"],
    grantType: "authorization_code",''',
)
replace_once(
    "frontend/lib/social/socialConfig.js",
    '''      "Go to Reddit Apps Preferences → Create App",
      "Select 'web app' type",
      "Set Redirect URI to: {callbackUrl}",
      "Copy App ID and Secret to the deployment environment",''',
    '''      "Request and receive Reddit Data API approval under the Responsible Builder Policy",
      "Create a web app and set Redirect URI to: {callbackUrl}",
      "Copy App ID and Secret to the deployment environment",
      "Set REDDIT_USER_AGENT to an identifiable app/version and Reddit username",''',
)
replace_once(
    "frontend/lib/social/socialConfig.js",
    '''  return Boolean(
    process.env[platform.clientEnvKey] &&
    process.env[platform.secretEnvKey]
  );''',
    '''  const requiredKeys = [
    platform.clientEnvKey,
    platform.secretEnvKey,
    ...(platform.requiredEnvKeys || []),
  ];
  return requiredKeys.every((key) => Boolean(process.env[key]));''',
)

# Studio styles for Reddit publish settings.
append(
    "frontend/app/studio-luxury.css",
    r'''
.review-publish-fields {
  margin-top: 1rem;
  padding-top: 0.9rem;
  border-top: 0.0625rem solid rgba(23, 23, 20, 0.1);
  display: grid;
  gap: 0.7rem;
}

.review-publish-fields label {
  display: grid;
  gap: 0.35rem;
}

.review-publish-fields label > span,
.review-publish-fields small {
  color: rgba(23, 23, 20, 0.5);
  font-size: var(--sf-type-meta);
}

.review-publish-fields input {
  width: 100%;
  min-height: 2.55rem;
  padding: 0.65rem 0.75rem;
  border: 0.0625rem solid var(--line);
  border-radius: 0.7rem;
  outline: 0;
  background: rgba(255, 255, 255, 0.72);
  color: var(--ink);
  font-size: var(--sf-type-support);
}

.review-publish-fields input:focus {
  border-color: rgba(201, 120, 93, 0.58);
  box-shadow: 0 0 0 0.2rem rgba(201, 120, 93, 0.08);
  background: var(--white);
}
''',
)

# Current platform prerequisites in the safe environment template.
replace_once(
    "frontend/.env.example",
    '''# X OAuth 2.0 with PKCE
# Callback: ${NEXTAUTH_URL}/api/social/callback/x
# Scopes: tweet.read, tweet.write, users.read, offline.access
X_CLIENT_ID=
X_CLIENT_SECRET=

# Reddit web app
# Callback: ${NEXTAUTH_URL}/api/social/callback/reddit
# Scopes: identity, submit, read
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=''',
    '''# X OAuth 2.0 with PKCE
# Callback: ${NEXTAUTH_URL}/api/social/callback/x
# Scopes: tweet.read, tweet.write, users.read, offline.access
# Current X API access is pay-per-use; fund credits and set a spending limit in the Developer Console.
X_CLIENT_ID=
X_CLIENT_SECRET=

# Reddit Data API web app
# Callback: ${NEXTAUTH_URL}/api/social/callback/reddit
# Scopes: identity, submit, read
# Explicit Data API approval is required under Reddit's Responsible Builder Policy.
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
# Example format: web:signalflow-studio:0.2.0 (by /u/your_reddit_username)
REDDIT_USER_AGENT=''',
)

# Documentation corrections based on current official platform requirements.
replace_once(
    "docs/CONNECTOR_READINESS.md",
    '''### X

```text
X_CLIENT_ID=
X_CLIENT_SECRET=
Callback: https://signal-flow-studio.vercel.app/api/social/callback/x
Scopes: tweet.read tweet.write users.read offline.access
Authentication: OAuth 2.0 Authorization Code with PKCE
```''',
    '''### X

```text
X_CLIENT_ID=
X_CLIENT_SECRET=
Callback: https://signal-flow-studio.vercel.app/api/social/callback/x
Scopes: tweet.read tweet.write users.read offline.access
Authentication: OAuth 2.0 Authorization Code with PKCE
```

The X API currently uses pay-per-use credits. The developer app must be approved, funded for write requests, and protected with a spending limit before a live test.''',
)
replace_once(
    "docs/CONNECTOR_READINESS.md",
    '''### Reddit

```text
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
Callback: https://signal-flow-studio.vercel.app/api/social/callback/reddit
Scopes: identity submit read
Application type: web app
```''',
    '''### Reddit

```text
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USER_AGENT=web:signalflow-studio:0.2.0 (by /u/<owner_username>)
Callback: https://signal-flow-studio.vercel.app/api/social/callback/reddit
Scopes: identity submit read
Application type: Data API web app
```

Creating an app record is not sufficient. Reddit currently requires explicit Data API approval under its Responsible Builder Policy, OAuth authentication, and an identifiable user agent. Direct publishing must remain unavailable until all three requirements are satisfied.''',
)
replace_once(
    "docs/CONNECTOR_READINESS.md",
    '''- Developer application exists.
- Production client ID and secret are configured server-side.''',
    '''- Developer application exists and any required platform/API access approval is granted.
- Production client ID, secret, and platform-specific identification settings are configured server-side.''',
)

append(
    "docs/CONNECTOR_READINESS.md",
    r'''
## Platform Documentation Check — July 24, 2026

- LinkedIn's current Marketing API version header is `202607`; the Posts API requires `Linkedin-Version`, `X-Restli-Protocol-Version: 2.0.0`, and `w_member_social` for member publishing.
- X supports `POST /2/tweets` with user OAuth, uses OAuth 2.0 PKCE scopes including `tweet.write`, and currently charges write operations through pay-per-use credits.
- Reddit requires OAuth and explicit Data API approval under the Responsible Builder Policy; clients must use an identifiable user agent and `submit` permission for post creation.

Re-check official documentation before every production credential rollout because platform access, pricing, scopes, and review requirements change independently of this repository.
''',
)

print("Final Studio connector safeguards applied.")
