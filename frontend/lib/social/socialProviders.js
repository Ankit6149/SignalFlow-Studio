import { SOCIAL_PLATFORMS } from "./socialConfig.js";
import { isTokenExpired, updateTokenSession } from "./tokenStore.js";

async function refreshLinkedInToken(refreshToken) {
  const platform = SOCIAL_PLATFORMS.linkedin;
  const response = await fetch(platform.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env[platform.clientEnvKey],
      client_secret: process.env[platform.secretEnvKey],
    }),
  });
  if (!response.ok) throw new Error(`LinkedIn token refresh failed (${response.status})`);
  return response.json();
}

async function refreshXToken(refreshToken) {
  const platform = SOCIAL_PLATFORMS.x;
  const credentials = Buffer.from(
    `${process.env[platform.clientEnvKey]}:${process.env[platform.secretEnvKey]}`,
  ).toString("base64");
  const response = await fetch(platform.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) throw new Error(`X token refresh failed (${response.status})`);
  return response.json();
}

async function refreshRedditToken(refreshToken) {
  const platform = SOCIAL_PLATFORMS.reddit;
  const credentials = Buffer.from(
    `${process.env[platform.clientEnvKey]}:${process.env[platform.secretEnvKey]}`,
  ).toString("base64");
  const response = await fetch(platform.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) throw new Error(`Reddit token refresh failed (${response.status})`);
  return response.json();
}

async function ensureValidToken(platformId, tokenSession) {
  if (!tokenSession?.access_token) {
    throw new Error(`No OAuth session is available for ${platformId}. Connect the account again.`);
  }

  let nextSession = tokenSession;
  if (isTokenExpired(nextSession)) {
    if (!nextSession.refresh_token) {
      throw new Error(`The ${platformId} session expired. Reconnect the account before publishing.`);
    }

    let newTokenData;
    switch (platformId) {
      case "linkedin":
        newTokenData = await refreshLinkedInToken(nextSession.refresh_token);
        break;
      case "x":
        newTokenData = await refreshXToken(nextSession.refresh_token);
        break;
      case "reddit":
        newTokenData = await refreshRedditToken(nextSession.refresh_token);
        break;
      default:
        throw new Error(`Token refresh is not supported for ${platformId}`);
    }

    nextSession = updateTokenSession(nextSession, newTokenData);
  }

  return { token: nextSession.access_token, tokenSession: nextSession };
}

export async function postToLinkedIn(content, projectName = "", tokenSession) {
  const valid = await ensureValidToken("linkedin", tokenSession);

  const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${valid.token}` },
  });
  if (!profileResponse.ok) {
    const errorText = await profileResponse.text();
    throw new Error(`LinkedIn profile fetch failed: ${errorText}`);
  }

  const profile = await profileResponse.json();
  const authorUrn = `urn:li:person:${profile.sub}`;
  const postBody = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: content.substring(0, 3000) },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${valid.token}`,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(postBody),
  });
  if (!postResponse.ok) {
    const errorText = await postResponse.text();
    throw new Error(`LinkedIn post failed (${postResponse.status}): ${errorText}`);
  }

  const responseBody = await postResponse.json().catch(() => ({}));
  const postId = responseBody.id || postResponse.headers.get("x-restli-id") || "";
  return {
    result: {
      ok: true,
      platform: "linkedin",
      postId,
      postUrl: postId ? `https://www.linkedin.com/feed/update/${postId}/` : "https://www.linkedin.com/feed/",
      message: `Published${projectName ? ` ${projectName}` : ""} to LinkedIn.`,
    },
    tokenSession: valid.tokenSession,
  };
}

export async function postToX(content, tokenSession) {
  const valid = await ensureValidToken("x", tokenSession);
  const parts = content.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);

  if (parts.length === 1 || content.length <= 280) {
    const response = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${valid.token}`,
      },
      body: JSON.stringify({ text: content.substring(0, 280) }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`X post failed (${response.status}): ${errorText}`);
    }

    const body = await response.json();
    const postId = body.data?.id || "";
    return {
      result: {
        ok: true,
        platform: "x",
        postId,
        postUrl: postId ? `https://x.com/i/status/${postId}` : "https://x.com",
        message: "Published to X.",
      },
      tokenSession: valid.tokenSession,
    };
  }

  let previousPostId = null;
  let firstPostId = null;
  const threadParts = parts.slice(0, 25);

  for (let index = 0; index < threadParts.length; index += 1) {
    const tweetBody = { text: threadParts[index].substring(0, 280) };
    if (previousPostId) {
      tweetBody.reply = { in_reply_to_tweet_id: previousPostId };
    }

    const response = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${valid.token}`,
      },
      body: JSON.stringify(tweetBody),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`X thread failed at post ${index + 1} (${response.status}): ${errorText}`);
    }

    const body = await response.json();
    previousPostId = body.data?.id || null;
    if (!firstPostId) firstPostId = previousPostId;
  }

  return {
    result: {
      ok: true,
      platform: "x",
      postId: firstPostId,
      postUrl: firstPostId ? `https://x.com/i/status/${firstPostId}` : "https://x.com",
      message: `Published a ${threadParts.length}-post thread to X.`,
    },
    tokenSession: valid.tokenSession,
  };
}

export async function postToReddit(content, options = {}, tokenSession) {
  const valid = await ensureValidToken("reddit", tokenSession);
  const subreddit = options.subreddit || "test";
  const title = options.title || options.projectName || "New Post";

  const response = await fetch("https://oauth.reddit.com/api/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${valid.token}`,
      "User-Agent": "SignalFlowStudio/1.0",
    },
    body: new URLSearchParams({
      kind: "self",
      sr: subreddit,
      title: title.substring(0, 300),
      text: content.substring(0, 40000),
      api_type: "json",
    }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Reddit submit failed (${response.status}): ${errorText}`);
  }

  const body = await response.json();
  if (body.json?.errors?.length) {
    throw new Error(`Reddit rejected the post: ${JSON.stringify(body.json.errors)}`);
  }

  const postUrl = body.json?.data?.url || "https://www.reddit.com";
  const postId = body.json?.data?.id || "";
  return {
    result: {
      ok: true,
      platform: "reddit",
      postId,
      postUrl,
      message: `Published to r/${subreddit}.`,
    },
    tokenSession: valid.tokenSession,
  };
}

export async function publishToSocial(platformId, content, options = {}, tokenSession) {
  switch (platformId) {
    case "linkedin":
      return postToLinkedIn(content, options.projectName, tokenSession);
    case "x":
      return postToX(content, tokenSession);
    case "reddit":
      return postToReddit(content, options, tokenSession);
    default:
      return {
        result: {
          ok: false,
          platform: platformId,
          error: `Direct publishing to "${platformId}" is not supported. Use manual copy or export.`,
          status: "manual_only",
        },
        tokenSession,
      };
  }
}
