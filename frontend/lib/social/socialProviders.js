import { getLinkedInApiVersion, SOCIAL_PLATFORMS } from "./socialConfig.js";
import { isTokenExpired, updateTokenSession } from "./tokenStore.js";
import { createSocialApiError } from "./socialErrors.js";

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
  if (!response.ok) throw await createSocialApiError(response, "LinkedIn", "token refresh");
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
  if (!response.ok) throw await createSocialApiError(response, "X", "token refresh");
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
  if (!response.ok) throw await createSocialApiError(response, "Reddit", "token refresh");
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
  const platform = SOCIAL_PLATFORMS.linkedin;
  const valid = await ensureValidToken("linkedin", tokenSession);

  const profileResponse = await fetch(platform.profileUrl, {
    headers: { Authorization: `Bearer ${valid.token}` },
  });
  if (!profileResponse.ok) {
    throw await createSocialApiError(profileResponse, "LinkedIn", "profile lookup");
  }

  const profile = await profileResponse.json();
  if (!profile.sub) {
    throw new Error("LinkedIn did not return the authenticated member identifier.");
  }

  const authorUrn = `urn:li:person:${profile.sub}`;
  const postBody = {
    author: authorUrn,
    commentary: content.substring(0, platform.postMaxLength),
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const postResponse = await fetch(platform.postEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${valid.token}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "Linkedin-Version": getLinkedInApiVersion(),
    },
    body: JSON.stringify(postBody),
  });
  if (!postResponse.ok) {
    throw await createSocialApiError(postResponse, "LinkedIn", "publishing");
  }

  const postId = postResponse.headers.get("x-restli-id") || "";
  return {
    result: {
      ok: true,
      platform: "linkedin",
      postId,
      postUrl: postId
        ? `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}/`
        : "https://www.linkedin.com/feed/",
      message: `Published${projectName ? ` ${projectName}` : ""} to LinkedIn.`,
    },
    tokenSession: valid.tokenSession,
  };
}

export async function postToX(content, tokenSession) {
  const platform = SOCIAL_PLATFORMS.x;
  const valid = await ensureValidToken("x", tokenSession);
  const parts = content.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);

  if (parts.length === 1 || content.length <= platform.postMaxLength) {
    const response = await fetch(platform.postEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${valid.token}`,
      },
      body: JSON.stringify({ text: content.substring(0, platform.postMaxLength) }),
    });
    if (!response.ok) {
      throw await createSocialApiError(response, "X", "publishing");
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
  const threadParts = parts.slice(0, platform.threadMaxLength);

  for (let index = 0; index < threadParts.length; index += 1) {
    const postBody = { text: threadParts[index].substring(0, platform.postMaxLength) };
    if (previousPostId) {
      postBody.reply = { in_reply_to_tweet_id: previousPostId };
    }

    const response = await fetch(platform.postEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${valid.token}`,
      },
      body: JSON.stringify(postBody),
    });
    if (!response.ok) {
      const error = await createSocialApiError(response, "X", `publishing thread post ${index + 1}`);
      throw error;
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
  const platform = SOCIAL_PLATFORMS.reddit;
  const valid = await ensureValidToken("reddit", tokenSession);
  const subreddit = options.subreddit || "test";
  const title = options.title || options.projectName || "New Post";

  const response = await fetch(platform.postEndpoint, {
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
      text: content.substring(0, platform.postMaxLength),
      api_type: "json",
    }),
  });
  if (!response.ok) {
    throw await createSocialApiError(response, "Reddit", "publishing");
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
